import { useEffect, useState } from 'react'
import type { Meta, Video } from '../../../../shared/types.ts'
import { useStreams } from '../../_hooks/use-streams.ts'
import { ipcError } from '../../format.ts'
import { nextEpisode, type Season } from '../../seasons.ts'
import { playable, playRequest } from '../../streams.ts'

const kalli = window.kalli

/**
 * Starts another episode from inside the player: its cópias are fetched, ranked like the entry page does, and the
 * best one replaces the playing video. `prefetch` gets the ranking ready ahead of time (the next episode, near the end).
 */
export function useEpisodeStart(meta: Meta | null | undefined, seasons: Season[], runtimeMin?: number) {
  const [target, setTarget] = useState<Video>()
  const [go, setGo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { ranked, measuring } = useStreams('series', target?.id, runtimeMin)
  const ready = !!ranked && !measuring

  useEffect(() => {
    if (!go || !ready || !target || !meta) return
    const best = ranked?.find(playable)
    if (!best) {
      setGo(false)
      return setError(`Nenhuma cópia de T${target.season} E${target.episode} toca agora. Escolha uma na página da série.`)
    }
    // The new video replaces this one; the overlay stays and redraws for it.
    kalli.play(playRequest(best, meta, target, nextEpisode(seasons, target.id), ranked ?? undefined)).catch((e) => {
      setGo(false)
      setError(`Não deu para abrir o episódio (${ipcError(e)}).`)
    })
  }, [go, ready, target?.id])

  return {
    prefetch: (v: Video) => target?.id !== v.id && setTarget(v),
    /** The finished ranking of the episode last prefetched or started, with that episode. */
    ranking: ready && target ? { episode: target, ranked: ranked! } : undefined,
    start: (v: Video) => {
      setError(null)
      if (target?.id !== v.id) setTarget(v)
      setGo(true)
    },
    /** The episode being started, until the new video takes over. */
    starting: go ? target : undefined,
    error,
    clearError: () => setError(null)
  }
}
