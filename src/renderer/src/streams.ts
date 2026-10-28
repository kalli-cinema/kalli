import type { Ranked } from '../../shared/ranking.ts'
import type { MetaPreview, PlayRequest, Stream, Video } from '../../shared/types.ts'
import { copyLabel, episodeLabel } from './format.ts'

export const playable = (r: Ranked) => r.verdict === 'instant' || r.verdict === 'tight' || r.verdict === 'p2p'
export const downloadable = (r: Ranked) => r.verdict !== 'uncached' && r.verdict !== 'unplayable' && r.verdict !== 'dead'

/** Tracker URLs an addon attached to a P2P cópia (`tracker:<url>` sources). */
export const trackers = (s: Stream) => s.sources?.filter((x) => x.startsWith('tracker:')).map((x) => x.slice(8))

/**
 * What to play for a title (or one of its episodes) from a ranked cópia; `next` is the episode after it.
 * With the whole ranking, the next three playable cópias ride along: main tries them if this one won't open.
 */
export function playRequest(r: Ranked, m: MetaPreview, ep?: Video, next?: Video, ranked?: Ranked[]): PlayRequest {
  const s = r.stream
  const fallbacks = ranked
    ?.filter((o) => o !== r && playable(o))
    .slice(0, 3)
    .map((o) => playRequest(o, m, ep, next))
  return {
    ...(fallbacks?.length && { fallbacks }),
    key: ep?.id ?? m.id,
    metaId: m.id,
    type: m.type,
    url: s.url ?? `magnet:?xt=urn:btih:${s.infoHash}`,
    torrent: s.infoHash && !s.url ? { infoHash: s.infoHash, fileIdx: s.fileIdx, trackers: trackers(s) } : undefined,
    headers: s.behaviorHints?.proxyHeaders?.request,
    title: ep ? `${m.name} · ${episodeLabel(ep)}` : m.name,
    poster: m.poster,
    background: ep?.thumbnail ?? m.background,
    label: copyLabel(r.info),
    next: next && { key: next.id, title: `${m.name} · ${episodeLabel(next)}`, background: next.thumbnail ?? m.background }
  }
}
