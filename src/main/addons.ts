import type { Addon, Manifest, Meta, MetaPreview, Stream, StreamResult, Subtitle } from '../shared/types.ts'
import { getJson } from './http.ts'

/** Installed on first run (and whenever none is left): catalogs and details, Portuguese metadata, subtitles. */
export const DEFAULTS = [
  'https://v3-cinemeta.strem.io/manifest.json',
  'https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json',
  'https://opensubtitles-v3.strem.io/manifest.json'
]

export async function fetchAddon(url: string): Promise<Addon> {
  const transportUrl = url.trim().replace(/^stremio:\/\//, 'https://')
  if (!/^https?:\/\/.+\/manifest\.json$/.test(transportUrl)) throw new Error('Cole a URL completa, terminando em manifest.json.')
  const manifest = await getJson<Manifest>(transportUrl)
  if (!manifest?.id || !Array.isArray(manifest.resources))
    throw new Error('Essa URL não é de um addon do Stremio. Copie de novo o link do manifest na página do addon.')
  manifest.catalogs ??= []
  return { transportUrl, manifest }
}

export function supports(a: Addon, resource: string, type: string, id?: string): boolean {
  const m = a.manifest
  const r = m.resources.find((r) => (typeof r === 'string' ? r : r.name) === resource)
  if (!r) return false
  const types = typeof r === 'string' ? m.types : r.types
  const prefixes = (typeof r === 'string' ? undefined : r.idPrefixes) ?? m.idPrefixes
  if (!types?.includes(type)) return false
  return !id || !prefixes?.length || prefixes.some((p) => id.startsWith(p))
}

// Stremio encodes extras as `/genre=Action&skip=100` with encodeURIComponent (not form `+`).
export function resourceUrl(a: Addon, resource: string, type: string, id: string, extra?: Record<string, string>) {
  const base = a.transportUrl.replace(/\/manifest\.json$/, '')
  const ex = extra && Object.keys(extra).length
    ? '/' + Object.entries(extra).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : ''
  return `${base}/${resource}/${type}/${encodeURIComponent(id)}${ex}.json`
}

export async function catalog(a: Addon, type: string, id: string, extra?: Record<string, string>) {
  // Search is typed live: a dead addon gives up sooner than a wall catalog does.
  const timeout = extra?.search ? 6000 : 15000
  const { metas } = await getJson<{ metas?: MetaPreview[] }>(resourceUrl(a, 'catalog', type, id, extra), { timeout })
  return metas ?? []
}

export async function meta(addons: Addon[], type: string, id: string): Promise<Meta | null> {
  for (const a of addons.filter((a) => supports(a, 'meta', type, id))) {
    try {
      const { meta } = await getJson<{ meta?: Meta }>(resourceUrl(a, 'meta', type, id))
      if (meta) return meta
    } catch {
      // next addon
    }
  }
  return null
}

/** `failed` of `asked` sources didn't answer: lets the UI tell "no cópias" from "sources are down". */
export async function streams(addons: Addon[], type: string, id: string): Promise<StreamResult> {
  const sources = addons.filter((a) => supports(a, 'stream', type, id))
  const results = await Promise.allSettled(
    sources.map(async (a) => {
      const { streams } = await getJson<{ streams?: Stream[] }>(resourceUrl(a, 'stream', type, id), { timeout: 30000 })
      return (streams ?? []).map((s) => ({ ...s, addon: a.manifest.name }))
    })
  )
  return {
    streams: results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    failed: results.filter((r) => r.status === 'rejected').length,
    asked: sources.length
  }
}

/** Subtitles from every addon that has them (OpenSubtitles v3, …); a slow or failing source is skipped. */
export async function subtitles(addons: Addon[], type: string, id: string): Promise<Subtitle[]> {
  const results = await Promise.allSettled(
    addons
      .filter((a) => supports(a, 'subtitles', type, id))
      .map((a) => getJson<{ subtitles?: Subtitle[] }>(resourceUrl(a, 'subtitles', type, id), { timeout: 8000 }))
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? (r.value.subtitles ?? []) : [])).filter((s) => /^https?:\/\//.test(s.url))
}

/** Reads up to 32 MB for ~4 s and returns Mbps. Debrid links share one CDN, so one probe covers the list. */
// Debrid addons answer a link they can't serve with a short explainer video (e.g. /videos/failed_*.mp4,
// downloading_*.mp4) or an error page: mpv "plays" those or exits with code 2. They count as dead links.
const ERROR_VIDEO = /\/videos\/(failed|downloading|download_failed)[^/]*\.mp4/i

/**
 * Measures a link's speed and checks it really serves video. `dead`: the server answered with an error, a web
 * page, or an explainer video instead of the file. A timeout or network error is neither: speed stays unknown.
 */
export async function probe(url: string, headers?: Record<string, string>, quick = false): Promise<{ mbps: number; dead?: boolean; resolved?: string }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 6000)
  try {
    const res = await fetch(url, { headers: { ...headers, Range: 'bytes=0-33554431' }, signal: ctl.signal })
    const type = res.headers.get('content-type') ?? ''
    if (res.status >= 400 || /^(text\/html|application\/json)/i.test(type) || ERROR_VIDEO.test(res.url)) {
      ctl.abort()
      return { mbps: 0, dead: true }
    }
    // Where the addon's link led (a debrid resolver redirects to its CDN): mpv can open that directly.
    const resolved = res.url !== url ? res.url : undefined
    // The host's speed is known: the answer above was all that was needed.
    if (quick) {
      ctl.abort()
      return { mbps: 0, resolved }
    }
    if (!res.ok || !res.body) throw new Error(`probe HTTP ${res.status}`)
    const reader = res.body.getReader()
    let bytes = 0
    let start = 0
    while (true) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }))
      if (done) break
      // Clock starts at the first byte so redirects and TLS don't count against the link.
      if (!start) start = performance.now()
      else bytes += value!.byteLength
      if (performance.now() - start > 4000) break
    }
    ctl.abort()
    const secs = (performance.now() - start) / 1000
    return { mbps: secs > 0.2 ? (bytes * 8) / 1e6 / secs : 0, resolved }
  } finally {
    clearTimeout(timer)
  }
}
