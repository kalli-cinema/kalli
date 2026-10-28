import { useEffect, useMemo, useState } from 'react'
import { hostOf, rankStreams, type Codec, type RankContext } from '../../../shared/ranking.ts'
import type { Probe, StreamResult } from '../../../shared/types.ts'
import { usePrefs, type Prefs } from '../prefs.ts'
import { playable } from '../streams.ts'

const kalli = window.kalli

type StreamState = { result: StreamResult | null; bandwidth: Record<string, number>; dead: Record<string, boolean>; measuring: boolean }
type Entry = { st: StreamState; subs: Set<(st: StreamState) => void>; at: number }
type Fit = Pick<RankContext, 'audio' | 'maxRes'>

const EMPTY: StreamState = { result: null, bandwidth: {}, dead: {}, measuring: false }
// A link checked minutes ago still leads where it did (main keeps each host's speed for 10 min too).
const FRESH_MS = 5 * 60_000
const KEEP = 40

// Cópias fetched and their pick checked, one run per video shared by whoever asks: a title resting on the wall
// gets its run ahead (`prefetchStreams`), and its page then opens on the finished pick.
const entries = new Map<string, Entry>()

const fitOf = (p: Prefs): Fit => ({ audio: p.profile.language === 'dub' ? 'dub' : 'original', maxRes: p.settings.maxRes })

/**
 * Fetches one video's cópias and checks its pick: a dead link drops out and the next one is checked, a slow host
 * makes way for the next pick's host. Up to six checks. `fresh` runs again even when a recent run exists.
 */
function load(type: string, videoId: string, fit: Fit, runtimeMin?: number, fresh = false): Entry {
  const key = `${type}|${videoId}|${fit.audio}|${fit.maxRes}`
  const old = entries.get(key)
  if (old && !fresh && Date.now() - old.at < FRESH_MS) return old
  const e: Entry = { st: EMPTY, subs: new Set(), at: Date.now() }
  entries.delete(key)
  entries.set(key, e)
  if (entries.size > KEEP) entries.delete(entries.keys().next().value!)
  const put = (st: StreamState) => ((e.st = st), e.subs.forEach((f) => f(st)))
  void kalli
    .streams(type, videoId)
    .catch((): StreamResult => ({ streams: [], failed: 1, asked: 1 }))
    .then(async (result) => {
      const bandwidth: Record<string, number> = {}
      const dead: Record<string, boolean> = {}
      const checked = new Set<string>()
      const ctx: RankContext = { runtimeMin, bandwidth, dead, ...fit }
      for (let n = 0; n < 6; n++) {
        const best = rankStreams(result.streams, ctx).find((r) => r.info.kind === 'http' && playable(r))
        const url = best?.stream.url
        if (!best || !url || checked.has(url)) break
        checked.add(url)
        put({ result, bandwidth: { ...bandwidth }, dead: { ...dead }, measuring: true })
        const probe = await kalli.bandwidth(url, best.stream.behaviorHints?.proxyHeaders?.request).catch(() => ({}) as Probe)
        // No speed (the probe timed out) leaves the host unknown: it isn't probed again.
        if (probe.dead) dead[url] = true
        else bandwidth[hostOf(url)] ??= probe.mbps ?? 0
      }
      put({ result, bandwidth, dead, measuring: false })
    })
  return e
}

/** A title at rest on the wall: its cópias and pick get ready before anyone opens it. */
export const prefetchStreams = (type: string, videoId: string, prefs: Prefs) => void load(type, videoId, fitOf(prefs))

/**
 * Cópias of one video ranked by quality, the profile's audio and the speed of their servers (see `load`); the
 * ranking follows the run as it checks links.
 */
export function useStreams(type: string, videoId: string | undefined, runtimeMin?: number) {
  const prefs = usePrefs()!
  const fit = fitOf(prefs)
  const [st, set] = useState<StreamState>(EMPTY)
  const [hw, setHw] = useState<Codec[] | undefined>()
  // Sources can take up to 30 s each: after 8 s say so instead of sitting silent.
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => void kalli.hw().then(setHw), [])
  useEffect(() => {
    if (!videoId) return set(EMPTY)
    const e = load(type, videoId, fit, runtimeMin, attempt > 0)
    set(e.st)
    setSlow(false)
    const t = e.st.result ? undefined : setTimeout(() => setSlow(true), 8000)
    const sub = (s: StreamState) => (set(s), s.result && clearTimeout(t))
    e.subs.add(sub)
    return () => (e.subs.delete(sub), clearTimeout(t))
  }, [type, videoId, attempt, fit.audio, fit.maxRes])
  const ranked = useMemo(
    () => (st.result ? rankStreams(st.result.streams, { runtimeMin, bandwidth: st.bandwidth, dead: st.dead, hwCodecs: hw, ...fit }) : null),
    [st.result, st.bandwidth, st.dead, hw, runtimeMin, fit.audio, fit.maxRes]
  )
  return {
    ranked,
    /** Measured speed of the pick's server. */
    bandwidth: ranked?.find(playable)?.linkMbps,
    measuring: st.measuring,
    slow,
    failed: st.result?.failed ?? 0,
    asked: st.result?.asked ?? 0,
    retry: () => setAttempt((n) => n + 1)
  }
}
