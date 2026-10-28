import { EventEmitter, once } from 'node:events'
import { createReadStream, createWriteStream, existsSync, mkdirSync, statfsSync, truncateSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, isAbsolute, join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { Download, DownloadRequest } from '../shared/types.ts'
import { downloadDir, save, state } from './store.ts'
import * as torrents from './torrents.ts'
import { isTrailerId, trailerPage } from './trailer.ts'

const jobs = new Map<string, { stop: () => void }>()
const growth = new EventEmitter().setMaxListeners(0)
let onChange: (d: Download) => void = () => {}

export const list = () => Object.values(state.downloads)


function changed(d: Download, persist = true) {
  // A removed download's job may still report while it winds down: that report must not bring it back.
  if (state.downloads[d.key] !== d) return
  onChange(d)
  if (persist) save()
}

/**
 * Deletes a download: stops it, removes it from the library and deletes its file. A torrent kept in its own folder
 * inside the library loses that folder (it holds only that torrent's files); nothing outside the library is touched.
 */
export async function remove(key: string) {
  const d = state.downloads[key]
  if (!d) return
  jobs.get(key)?.stop()
  jobs.delete(key)
  delete state.downloads[key]
  save()
  const lib = downloadDir()
  const rel = d.file ? relative(lib, d.file) : ''
  const inside = rel && !rel.startsWith('..') && !isAbsolute(rel)
  if (inside) {
    const top = rel.split(/[\\/]/)
    // Windows keeps a file locked for a moment after its writer closes: retry instead of failing.
    await rm(join(lib, d.torrent && top.length > 1 ? top[0] : rel), { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  }
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)

// A download ahead needs room for a remux episode and then some: below this much free space it waits for a person.
const AHEAD_FREE = 60e9

export function add({ fallbacks: _, ...req }: DownloadRequest): Download | undefined {
  const existing = state.downloads[req.key]
  if (existing) {
    if (req.ahead) return existing
    // Asked for by a person: it stays after being watched.
    existing.ahead = false
    // Same video again: keep the bytes we have, continue from the freshly resolved link.
    if (!jobs.has(req.key) && existing.state !== 'done') Object.assign(existing, { url: req.url, headers: req.headers })
    return resume(req.key)!
  }
  const dir = downloadDir()
  mkdirSync(dir, { recursive: true })
  if (req.ahead) {
    const { bavail, bsize } = statfsSync(dir)
    if (bavail * bsize < AHEAD_FREE) return undefined
  }
  const ext = extname(req.filename ?? (req.torrent ? '' : new URL(req.url).pathname)) || '.mkv'
  const d: Download = {
    ...req,
    // A torrent names its own file once metadata arrives.
    file: req.torrent ? '' : join(dir, safeName(req.filename ? req.filename.replace(/\.[^.]+$/, '') : req.title) + ext),
    size: 0,
    received: 0,
    state: 'downloading',
    at: Date.now()
  }
  state.downloads[req.key] = d
  void run(d)
  changed(d)
  return d
}

export function pause(key: string) {
  held.delete(key)
  jobs.get(key)?.stop()
}

// Downloads ahead share the line with the video playing: they step aside while its buffer runs short.
const held = new Set<string>()
/**
 * `true` pauses running downloads ahead; `false` resumes the ones this paused (never one a person paused).
 * Either is safe to repeat.
 */
export function holdAhead(on: boolean) {
  if (on) for (const d of list()) d.ahead && jobs.has(d.key) && (pause(d.key), held.add(d.key))
  else for (const k of held) (held.delete(k), resume(k))
}

export function resume(key: string) {
  const d = state.downloads[key]
  if (!d || d.state === 'done' || jobs.has(key)) return d
  void (d.torrent ? runTorrent(d) : run(d))
  return d
}

/** Restart downloads that were running when the app quit. */
export function resumeAll(cb: (d: Download) => void) {
  onChange = cb
  for (const d of Object.values(state.downloads)) if (d.state === 'downloading') resume(d.key)
}

/** Where mpv should read a download that is still arriving. */
export async function playUrl(d: Download) {
  return d.torrent ? torrents.urlFor(d.torrent, downloadDir()) : localUrl(d.key)
}

async function runTorrent(d: Download) {
  let job: torrents.TorrentJob | null = null
  const stop = (next: Download['state']) => {
    job?.stop()
    jobs.delete(d.key)
    d.state = next
    changed(d)
  }
  jobs.set(d.key, { stop: () => stop('paused') })
  d.state = 'downloading'
  d.error = undefined
  changed(d)
  let lastSave = Date.now()
  try {
    job = await torrents.download(d.torrent!, downloadDir(), (p) => {
      Object.assign(d, { received: p.received, size: p.size, file: p.file })
      if (p.done) return stop('done')
      const persist = Date.now() - lastSave > 10_000
      if (persist) lastSave = Date.now()
      changed(d, persist)
    })
    // Paused or finished while metadata was still loading.
    if (!jobs.has(d.key)) job.stop()
  } catch (e) {
    d.error = e instanceof Error ? e.message : String(e)
    stop('error')
  }
}

// One sequential stream so the front of the file fills first and can play while the rest arrives.
// ponytail: single connection; add parallel segments behind the playhead if a host caps per-connection speed.
async function run(d: Download) {
  const ctl = new AbortController()
  jobs.set(d.key, { stop: () => ctl.abort() })
  d.state = 'downloading'
  d.error = undefined
  changed(d)
  let lastUi = 0
  let lastSave = Date.now()
  for (let attempt = 0; attempt < 6 && !ctl.signal.aborted; attempt++) {
    try {
      if (!existsSync(d.file)) d.received = 0
      trimTo(d.file, d.received)
      const res = await fetch(d.url, {
        headers: { ...d.headers, ...(d.received ? { Range: `bytes=${d.received}-` } : {}) },
        signal: ctl.signal
      })
      if (d.received && res.status === 200) {
        // Server ignored Range: start over rather than corrupt the file.
        d.received = 0
        trimTo(d.file, 0)
      } else if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const total =
        res.status === 206 ? Number(res.headers.get('content-range')?.split('/')[1]) : Number(res.headers.get('content-length'))
      if (total) d.size = total
      const out = createWriteStream(d.file, { flags: 'a' })
      try {
        for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
          // Count bytes only once they're on disk: the media server reads up to `received`.
          const ok = out.write(chunk, () => {
            d.received += chunk.byteLength
            growth.emit(d.key)
            if (Date.now() - lastUi > 1000) {
              lastUi = Date.now()
              // Persist every ~10 s; a crash loses at most that much (trimTo realigns the file).
              const persist = lastUi - lastSave > 10_000
              if (persist) lastSave = lastUi
              changed(d, persist)
            }
          })
          if (!ok) await once(out, 'drain')
        }
      } finally {
        await new Promise((r) => out.end(r))
      }
      if (d.size && d.received < d.size) throw new Error('connection closed early')
      d.state = 'done'
      d.size ||= d.received
      break
    } catch (e) {
      if (ctl.signal.aborted) break
      d.error = e instanceof Error ? e.message : String(e)
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
    }
  }
  if (d.state !== 'done') d.state = ctl.signal.aborted ? 'paused' : 'error'
  jobs.delete(d.key)
  growth.emit(d.key)
  changed(d)
}

// Drops any bytes written after the last confirmed `received` (crash mid-write), so appends line up.
function trimTo(file: string, len: number) {
  if (existsSync(file)) truncateSync(file, len)
}

// --- Local media server: lets mpv play a download while it is still arriving. ---

/** Seeks this far past the downloaded edge go straight to the source instead of waiting. */
const AHEAD = 16 * 1024 * 1024

let port = 0

const localUrl = (key: string) => `http://127.0.0.1:${port}/dl/${encodeURIComponent(key)}`

/** The page that plays a title's trailer behind its entry (see `trailer.ts`). */
export const trailerUrl = (id: string, sound = false) =>
  isTrailerId(id) && port ? `http://127.0.0.1:${port}/trailer/${id}${sound ? '?sound' : ''}` : undefined

export function startServer() {
  const server = createServer(async (req, res) => {
    // Only mpv on this machine: a rebound hostname from a web page fails the Host check.
    if (req.headers.host !== `127.0.0.1:${port}`) return void req.destroy()
    const trailer = /^\/trailer\/([\w-]{11})(\?sound)?$/.exec(req.url ?? '')
    if (trailer)
      return void res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(trailerPage(trailer[1], `http://127.0.0.1:${port}`, !!trailer[2]))
    const d = state.downloads[decodeURIComponent(req.url?.replace(/^\/dl\//, '') ?? '')]
    if (!d || !d.size) return void res.writeHead(404).end()

    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
    const start = m ? Number(m[1]) : 0
    const end = m?.[2] ? Math.min(Number(m[2]), d.size - 1) : d.size - 1
    if (start >= d.size) return void res.writeHead(416, { 'Content-Range': `bytes */${d.size}` }).end()

    res.writeHead(m ? 206 : 200, {
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      ...(m ? { 'Content-Range': `bytes ${start}-${end}/${d.size}` } : {})
    })
    let closed = false
    res.on('close', () => (closed = true))

    try {
      let pos = start
      while (pos <= end && !closed) {
        if (pos < d.received) {
          const to = Math.min(end, d.received - 1)
          await pipeline(createReadStream(d.file, { start: pos, end: to }), res, { end: false })
          pos = to + 1
        } else if (d.state === 'downloading' && pos - d.received < AHEAD) {
          await once(growth, d.key, { signal: AbortSignal.timeout(30_000) })
        } else {
          // Far seek (mkv cues live at the end) or the download stopped: read the source directly.
          await proxy(d, pos, end, res)
          pos = end + 1
        }
      }
    } catch {
      // client went away or the source failed; mpv retries on its own
    }
    res.end()
  })
  server.listen(0, '127.0.0.1', () => (port = (server.address() as AddressInfo).port))
}

async function proxy(d: Download, start: number, end: number, res: ServerResponse) {
  const ctl = new AbortController()
  res.once('close', () => ctl.abort())
  const src = await fetch(d.url, { headers: { ...d.headers, Range: `bytes=${start}-${end}` }, signal: ctl.signal })
  if (src.status !== 206 || !src.body) throw new Error(`source HTTP ${src.status}`)
  await pipeline(Readable.fromWeb(src.body as never), res, { end: false })
}
