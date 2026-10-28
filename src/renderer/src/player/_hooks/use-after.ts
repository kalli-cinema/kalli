import { useEffect, useState } from 'react'
import { parseRuntime } from '../../../../shared/ranking.ts'
import type { After, PlayRequest } from '../../../../shared/types.ts'
import { useStreams } from '../../_hooks/use-streams.ts'
import { ipcError } from '../../format.ts'
import { playable, playRequest } from '../../streams.ts'

const kalli = window.kalli

/**
 * A film's end card: what follows it (TMDB), asked for once the credits are near. The next film of its collection
 * is ranked ahead, so A starts it at once; it never starts by itself (a new film is a choice, not a binge).
 */
export function useAfter(req: PlayRequest, near: boolean) {
  const [after, setAfter] = useState<After>()
  useEffect(() => {
    if (near && !after && req.type === 'movie') void kalli.after(req.metaId).then(setAfter, () => {})
  }, [near])
  const next = after?.next
  const { ranked, measuring } = useStreams('movie', next?.id, parseRuntime(next?.runtime))
  const [go, setGo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!go || !next || !ranked || measuring) return
    const best = ranked.find(playable)
    if (!best) {
      setGo(false)
      return setError(`Nenhuma cópia de ${next.name} toca agora. Escolha uma na página do filme.`)
    }
    // The new film replaces this one; the overlay stays and redraws for it.
    kalli.play(playRequest(best, next, undefined, undefined, ranked)).catch((e) => {
      setGo(false)
      setError(`Não deu para abrir ${next.name} (${ipcError(e)}).`)
    })
  }, [go, ranked, measuring])

  return {
    after,
    starting: go,
    start: () => (setError(null), setGo(true)),
    error,
    clearError: () => setError(null)
  }
}
