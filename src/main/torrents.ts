import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TorrentRef } from '../shared/types.ts'

// P2P cópias through WebTorrent: its HTTP server streams any byte range, fetching those pieces
// first, so playback can start (and seek) long before the file is complete.

const TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://open.stealth.si:80/announce'
]
const VIDEO = /\.(mkv|mp4|m4v|avi|mov|webm|ts|m2ts|wmv)$/i
const STREAM_DIR = join(tmpdir(), 'kalli-torrents')

/* eslint-disable @typescript-eslint/no-explicit-any -- webtorrent ships no types */
type Torrent = any
type TorrentFile = { path: string; length: number; downloaded: number; done: boolean; streamURL: string; select(): void; once(e: 'done', f: () => void): void }

let client: Promise<{ wt: any; port: number }> | null = null

function getClient() {
  client ??= (async () => {
    const { default: WebTorrent } = (await import('webtorrent')) as { default: new (o: object) => any }
    const wt = new WebTorrent({ maxConns: 80 })
    wt.on('error', (e: Error) => console.warn('webtorrent:', e.message))
    // Loopback only, no CORS, Host checked: web pages can't read the stream (DNS rebinding included).
    const server = wt.createServer({ origin: false, hostname: '127.0.0.1' }, 'node')
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    return { wt, port: server.server.address().port as number }
  })()
  return client
}

const magnet = (t: TorrentRef) => `magnet:?xt=urn:btih:${t.infoHash}`

/** Adds the torrent (or reuses it) with only the wanted file selected. */
async function open(t: TorrentRef, path: string): Promise<{ torrent: Torrent; file: TorrentFile; url: string }> {
  const { wt, port } = await getClient()
  let torrent: Torrent = await wt.get(t.infoHash)
  if (torrent && torrent.path !== path) {
    // Streaming copy in the temp dir, now wanted in the library (or the reverse): restart it there.
    await new Promise((r) => torrent.destroy({ destroyStore: torrent.path === STREAM_DIR }, r))
    torrent = null
  }
  torrent ??= wt.add(magnet(t), { path, deselect: true, announce: [...(t.trackers ?? []), ...TRACKERS] })
  if (!torrent.ready)
    await once(torrent, 'ready', { signal: AbortSignal.timeout(90_000) }).catch(() => {
      throw new Error('nenhuma fonte do torrent respondeu em 90 segundos')
    })
  const files: TorrentFile[] = torrent.files
  // Addons give the file index; otherwise the largest video file is the film.
  const file =
    (t.fileIdx != null ? files[t.fileIdx] : undefined) ??
    files.filter((f) => VIDEO.test(f.path)).sort((a, b) => b.length - a.length)[0] ??
    files[0]
  file.select()
  return { torrent, file, url: `http://127.0.0.1:${port}${file.streamURL}` }
}

const streaming = new Set<string>()

/** Plays without keeping anything: data goes to the temp dir and is deleted when playback ends. */
export async function stream(t: TorrentRef) {
  streaming.add(t.infoHash)
  return (await open(t, STREAM_DIR)).url
}

export async function release(t: TorrentRef) {
  if (!streaming.delete(t.infoHash)) return
  const { wt } = await getClient()
  const torrent = await wt.get(t.infoHash)
  if (torrent?.path === STREAM_DIR) torrent.destroy({ destroyStore: true })
}

export type TorrentJob = { stop: () => void }

/** Downloads into the library, reporting progress. */
export async function download(
  t: TorrentRef,
  dir: string,
  onProgress: (p: { received: number; size: number; file: string; done: boolean }) => void
): Promise<TorrentJob> {
  streaming.delete(t.infoHash)
  const { torrent, file } = await open(t, dir)
  const report = () =>
    onProgress({ received: Math.min(file.downloaded, file.length), size: file.length, file: join(dir, file.path), done: file.done })
  const timer = setInterval(report, 1000)
  report()
  if (!file.done) file.once('done', report)
  return {
    stop: () => {
      clearInterval(timer)
      torrent.destroy()
    }
  }
}

/** Stream URL for a torrent download already running (watch while it downloads). */
export async function urlFor(t: TorrentRef, dir: string) {
  return (await open(t, dir)).url
}
