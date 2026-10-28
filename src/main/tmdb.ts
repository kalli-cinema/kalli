import { nextPart, type Part } from '../shared/after.ts'
import type { Meta } from '../shared/types.ts'
import { getJson } from './http.ts'

// Cinemeta speaks English. With a TMDB key, titles, synopses and episode names come in PT-BR.
// Only the IMDb id leaves the machine.

type Localized = { name?: string; description?: string; episodes?: Record<string, { title: string; overview?: string }> }

const cache = new Map<string, Promise<Localized | null>>()

export const clear = () => cache.clear()

function tmdb<T>(path: string, key: string): Promise<T> {
  // v4 read tokens are long JWTs sent as Bearer; v3 keys are 32 hex chars in the query.
  const bearer = key.length > 40
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://api.themoviedb.org/3${path}${sep}language=pt-BR${bearer ? '' : `&api_key=${encodeURIComponent(key)}`}`
  return getJson<T>(url, { timeout: 8000, headers: bearer ? { Authorization: `Bearer ${key}` } : undefined })
}

type Found = {
  movie_results?: { id: number; title?: string; overview?: string }[]
  tv_results?: { id: number; name?: string; overview?: string }[]
}
type Season = { episodes?: { season_number: number; episode_number: number; name?: string; overview?: string }[] }

async function load(imdb: string, seasons: number[], key: string): Promise<Localized | null> {
  const found = await tmdb<Found>(`/find/${imdb}?external_source=imdb_id`, key)
  const movie = found.movie_results?.[0]
  const tv = found.tv_results?.[0]
  if (!movie && !tv) return null
  const out: Localized = { name: movie?.title ?? tv?.name, description: (movie ?? tv)?.overview || undefined }
  if (tv && seasons.length) {
    out.episodes = {}
    const results = await Promise.allSettled(seasons.map((s) => tmdb<Season>(`/tv/${tv.id}/season/${s}`, key)))
    for (const r of results)
      if (r.status === 'fulfilled')
        for (const e of r.value.episodes ?? [])
          // Untranslated episodes come back as "Episódio 3": keep the original name then.
          if (e.name && !/^Episódio \d+$/i.test(e.name))
            out.episodes[`${e.season_number}:${e.episode_number}`] = { title: e.name, overview: e.overview || undefined }
  }
  return out
}

type Movie = { belongs_to_collection?: { id: number } | null; recommendations?: { results?: Part[] } }

/** What follows a film, as IMDb ids: the next film of its collection (already out) and up to `n` films like it. */
export async function after(imdb: string, key: string, n: number): Promise<{ next?: string; recs: string[] }> {
  const id = (await tmdb<Found>(`/find/${imdb}?external_source=imdb_id`, key)).movie_results?.[0]?.id
  if (!id) return { recs: [] }
  const movie = await tmdb<Movie>(`/movie/${id}?append_to_response=recommendations`, key)
  const saga = movie.belongs_to_collection?.id
  const parts = saga ? ((await tmdb<{ parts?: Part[] }>(`/collection/${saga}`, key).catch(() => ({ parts: [] }))).parts ?? []) : []
  const next = nextPart(parts, id, new Date().toISOString().slice(0, 10))
  const imdbOf = (p: Part) =>
    tmdb<{ imdb_id?: string }>(`/movie/${p.id}/external_ids`, key)
      .then((x) => x.imdb_id || undefined)
      .catch(() => undefined)
  const [nextId, ...recs] = await Promise.all([next && imdbOf(next), ...(movie.recommendations?.results ?? []).slice(0, n).map(imdbOf)])
  return { next: nextId, recs: recs.filter((r): r is string => !!r) }
}

/** `episodes` only for the entry page: the wall needs just the title and synopsis. */
export async function localize(meta: Meta, key: string, episodes: boolean): Promise<Meta> {
  const imdb = meta.id.split(':')[0]
  if (!key || !imdb.startsWith('tt')) return meta
  const seasons = episodes ? [...new Set((meta.videos ?? []).map((v) => v.season).filter((s): s is number => s != null))] : []
  const ck = `${imdb}|${episodes}`
  if (!cache.has(ck)) cache.set(ck, load(imdb, seasons, key).catch(() => null))
  const l = await cache.get(ck)!
  if (!l) return meta
  return {
    ...meta,
    name: l.name || meta.name,
    description: l.description || meta.description,
    videos: meta.videos?.map((v) => {
      const e = l.episodes?.[`${v.season}:${v.episode}`]
      return e ? { ...v, title: e.title, name: e.title, overview: e.overview ?? v.overview } : v
    })
  }
}
