import type { Video } from '../../shared/types.ts'

export type Season = { season: number; eps: Video[] }

/** Episodes by season, in order; specials (season 0) only when there is nothing else. */
export function groupSeasons(videos: Video[] = []): Season[] {
  const by = new Map<number, Video[]>()
  for (const v of videos) {
    const s = v.season ?? 1
    if (!by.has(s)) by.set(s, [])
    by.get(s)!.push(v)
  }
  for (const list of by.values()) list.sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0))
  const keys = [...by.keys()].sort((a, b) => a - b)
  const real = keys.filter((k) => k > 0)
  return (real.length ? real : keys).map((k) => ({ season: k, eps: by.get(k)! }))
}

/** Every episode in watch order, with its season and episode index. */
export const flatEpisodes = (seasons: Season[]) => seasons.flatMap((s, si) => s.eps.map((v, ei) => ({ si, ei, v })))

/** The episode after `id` in watch order (into the next season), if any. */
export function nextEpisode(seasons: Season[], id: string): Video | undefined {
  const flat = flatEpisodes(seasons)
  const at = flat.findIndex((x) => x.v.id === id)
  return at >= 0 ? flat[at + 1]?.v : undefined
}
