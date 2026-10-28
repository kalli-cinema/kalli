import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Download, History, Meta, MetaPreview, PlayerStatus, Progress, UpNext } from '../../shared/types.ts'
import { sectionName } from './format.ts'

const kalli = window.kalli

export type Section = { key: string; addonUrl: string; type: string; id: string; name: string }

/** Every catalog of every installed addon; `version` reloads them after addons change. */
export function useSections(version = 0): Section[] | null {
  const [sections, set] = useState<Section[] | null>(null)
  useEffect(() => {
    kalli.addons().then((addons) =>
      set(
        addons.flatMap((a) =>
          a.manifest.catalogs
            .filter((c) => !c.extra?.some((e) => e.isRequired))
            .map((c) => ({
              key: `${a.transportUrl}|${c.type}|${c.id}`,
              addonUrl: a.transportUrl,
              type: c.type,
              id: c.id,
              name: sectionName(c.type, c.name)
            }))
        )
      )
    )
  }, [version])
  return sections
}

const catalogs = new Map<string, MetaPreview[]>()

// ponytail: the wall wraps at 300 titles (3 pages); search reaches the rest.
const MAX_ITEMS = 300

type CatalogState = { items: MetaPreview[] | null; failed: boolean; retry: () => void }

// The wall comes up at once with what it showed last time (first 100 titles per section, in this browser's
// storage); the addon's fresh list replaces it as it lands.
// ponytail: swapped whole, so a title can change under a focus that moved within the first second.
const SAVED = 'kalli:catalog:'
const saved = (key: string): MetaPreview[] | undefined => {
  try {
    return JSON.parse(localStorage.getItem(SAVED + key) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
const keep = (key: string, items: MetaPreview[]) => {
  try {
    localStorage.setItem(SAVED + key, JSON.stringify(items.slice(0, 100)))
  } catch {
    // storage full or blocked: next launch just waits for the addon
  }
}

/** First page renders immediately; two more follow in the background. A failed first page is an error, not "empty". */
export function useCatalog(s: Section | undefined): CatalogState {
  const [items, set] = useState<MetaPreview[] | null>(s ? (catalogs.get(s.key) ?? saved(s.key) ?? null) : null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!s) return
    let alive = true
    const cached = catalogs.get(s.key)
    const last = cached ? undefined : saved(s.key)
    set(cached ?? last ?? null)
    setFailed(false)
    if (cached) return
    ;(async () => {
      const all: MetaPreview[] = []
      const seen = new Set<string>()
      while (all.length < MAX_ITEMS) {
        let page: MetaPreview[]
        try {
          page = await kalli.catalog(s.addonUrl, s.type, s.id, all.length ? { skip: String(all.length) } : undefined)
        } catch {
          // Later pages failing just end the wall early; the first one failing is the section failing (unless
          // last time's list is up: offline, it stays).
          if (all.length) break
          if (alive && !last) setFailed(true)
          return
        }
        const fresh = page.filter((m) => !seen.has(m.id) && seen.add(m.id))
        if (!fresh.length) break
        all.push(...fresh)
        catalogs.set(s.key, [...all])
        if (alive) set([...all])
      }
      if (all.length) keep(s.key, all)
      else if (alive && !last) set([])
    })()
    return () => void (alive = false)
  }, [s?.key, attempt])
  return { items, failed, retry: () => setAttempt((n) => n + 1) }
}

/** Films the wall has loaded this session (the pre-show's reel without TMDB). */
export const wallFilms = () => [...catalogs.values()].flat().filter((m) => m.type === 'movie')

const metas = new Map<string, Promise<Meta | null>>()
export const getMeta = (type: string, id: string, full = false) => {
  const k = `${type}/${id}/${full}`
  if (!metas.has(k)) metas.set(k, kalli.meta(type, id, full).catch(() => null))
  return metas.get(k)!
}

export function useMeta(type: string, id: string | undefined, full = false): Meta | null | undefined {
  const [meta, set] = useState<Meta | null | undefined>(undefined)
  useEffect(() => {
    if (!id) return
    let alive = true
    set(undefined)
    getMeta(type, id, full).then((m) => alive && set(m))
    return () => void (alive = false)
  }, [type, id, full])
  // Never hand back the previous title's meta while the next one loads.
  return meta && meta.id === id ? meta : meta === null ? null : undefined
}

type SearchState = { results: MetaPreview[] | null; searchable: boolean }

/** Every addon catalog that accepts `search`, queried together; results merged without duplicates as each one answers. */
export function useSearch(q: string): SearchState {
  const [st, set] = useState<SearchState>({ results: [], searchable: true })
  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) return void set((s) => ({ ...s, results: [] }))
    let alive = true
    set((s) => ({ ...s, results: null }))
    const t = setTimeout(async () => {
      const addons = await kalli.addons()
      const targets = addons.flatMap((a) =>
        a.manifest.catalogs.filter((c) => c.extra?.some((e) => e.name === 'search')).map((c) => ({ a, c }))
      )
      if (!targets.length) return void (alive && set({ results: [], searchable: false }))
      // A slow addon must not hold back the fast ones: show what has landed, still "Buscando" while nothing has.
      const pages: (MetaPreview[] | undefined)[] = targets.map(() => undefined)
      const show = () => {
        // Interleave catalogues (films, series…) so the best match of each sits up front.
        const seen = new Set<string>()
        const merged: MetaPreview[] = []
        for (let i = 0; i < Math.max(0, ...pages.map((p) => p?.length ?? 0)); i++)
          for (const p of pages) if (p?.[i] && !seen.has(p[i].id) && seen.add(p[i].id)) merged.push(p[i])
        const done = pages.every(Boolean)
        if (alive) set({ results: merged.length || done ? merged.slice(0, 60) : null, searchable: true })
      }
      targets.forEach(({ a, c }, i) =>
        kalli
          .catalog(a.transportUrl, c.type, c.id, { search: query })
          .catch(() => [] as MetaPreview[])
          .then((p) => ((pages[i] = p), show()))
      )
    }, 450)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q])
  return st
}

// --- History and downloads: one shared snapshot, refreshed by main-process events. ---

export type Library = History & { downloads: Record<string, Download> }
let library: Library = { progress: {}, watched: {}, upNext: {}, dismissed: {}, tracks: {}, rated: {}, downloads: {} }
const listeners = new Set<() => void>()
const emit = (next: Partial<Library>) => {
  library = { ...library, ...next }
  listeners.forEach((l) => l())
}

export async function refreshLibrary() {
  const [h, d] = await Promise.all([kalli.history(), kalli.downloads()])
  emit({ ...h, downloads: Object.fromEntries(d.map((x) => [x.key, x])) })
}

kalli.onDownload((d) => emit({ downloads: { ...library.downloads, [d.key]: d } }))
kalli.onPlayerExit(() => void refreshLibrary())
void refreshLibrary()

export const useLibrary = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => library
  )

// --- The player (mpv): fetched once on first run when the system has none. ---

let player: PlayerStatus = { state: 'installing' }
const playerListeners = new Set<() => void>()
const setPlayer = (s: PlayerStatus) => ((player = s), playerListeners.forEach((l) => l()))
void kalli.player().then(setPlayer)
kalli.onPlayerStatus(setPlayer)

export const usePlayerStatus = () =>
  useSyncExternalStore(
    (l) => (playerListeners.add(l), () => playerListeners.delete(l)),
    () => player
  )

/** One Continuar tile: a video in progress, a download, or the next episode of a series. */
export type RailItem = {
  key: string
  metaId: string
  type: string
  title: string
  background?: string
  poster?: string
  at: number
  progress?: Progress
  download?: Download
  upNext?: UpNext
}

/** Continuar: in progress, next episodes, downloads; newest first, one per title, minus what was removed. */
export function railItems(lib: Library): RailItem[] {
  const byTitle = new Map<string, RailItem>()
  const put = (item: RailItem) => {
    if ((lib.dismissed[item.metaId] ?? 0) >= item.at) return
    const cur = byTitle.get(item.metaId)
    if (!cur || cur.at < item.at) byTitle.set(item.metaId, item)
  }
  for (const p of Object.values(lib.progress)) put({ ...p, progress: p })
  for (const u of Object.values(lib.upNext)) if (!lib.watched[u.key]) put({ ...u, upNext: u })
  for (const d of Object.values(lib.downloads))
    if (!lib.watched[d.key]) put({ ...d, download: d, progress: lib.progress[d.key] })
  return [...byTitle.values()].sort((a, b) => b.at - a.at).slice(0, 20)
}

/** Takes a title out of Continuar. */
export const forget = async (metaId: string) => emit(await kalli.forget(metaId))

/** Image URLs: Cinemeta posters/backdrops come from metahub in fixed sizes. */
export const sized = (url: string | undefined, size: 'small' | 'medium' | 'large') =>
  url?.replace(/\/(small|medium|large)\//, `/${size}/`)
