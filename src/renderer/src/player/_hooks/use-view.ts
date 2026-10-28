import { useEffect, useState } from 'react'
import type { PlayerView } from '../../../../shared/types.ts'

const kalli = window.kalli

/** What mpv is doing, as main pushes it (four times a second while time moves, at once for anything else). */
export function useView() {
  const [view, set] = useState<PlayerView | null>(null)
  useEffect(() => {
    const off = kalli.onPlayerView(set)
    // The overlay can load after the first pushes: ask once.
    void kalli.playerView().then((v) => v && set((cur) => cur ?? v))
    return off
  }, [])
  return view
}
