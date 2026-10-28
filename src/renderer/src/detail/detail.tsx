import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseRuntime, type Ranked } from '../../../shared/ranking.ts'
import type { Meta, MetaPreview, PlayRequest } from '../../../shared/types.ts'
import { Cover } from '../_components/cover.tsx'
import { Hint } from '../_components/hint.tsx'
import { Check, DownloadIcon, Pause, Play } from '../_components/icons.tsx'
import { sized, useLibrary, useMeta } from '../data.ts'
import { clock, credits, episodeLabel, facts, percent } from '../format.ts'
import { useActions } from '../input.ts'
import { leave, settle, travel, tx, ty } from '../motion.ts'
import { usePrefs } from '../prefs.ts'
import { ActionButton } from './_components/action-button.tsx'
import { Copies } from './_components/copies.tsx'
import { CopyLine } from './_components/copy-line.tsx'
import { Episodes } from './_components/episodes.tsx'
import { Trailer } from './_components/trailer.tsx'
import { useStreams } from '../_hooks/use-streams.ts'
import { flatEpisodes, groupSeasons, nextEpisode } from '../seasons.ts'
import { downloadable, playable, playRequest } from '../streams.ts'

const kalli = window.kalli

type Mode = 'episodes' | 'actions'

type DetailProps = {
  item: MetaPreview
  onClose: () => void
  onPlay: (req: PlayRequest) => void
  active: boolean
  /** Opened from Continuar's "next episode": play the best cópia of where we are as soon as it's known. */
  autoPlay?: boolean
}

export function Detail({ item, onClose, onPlay, active, autoPlay }: DetailProps) {
  const meta = useMeta(item.type, item.id, true)
  const m: MetaPreview & Partial<Meta> = { ...item, ...meta }
  const lib = useLibrary()
  const prefs = usePrefs()
  const calm = useReducedMotion()
  const isSeries = item.type === 'series' && !!m.videos?.length

  // Series: seasons and "where we are" (the episode in progress, else the first unwatched).
  const seasons = useMemo(() => groupSeasons(m.videos), [m.videos])

  const here = useMemo(() => {
    const flat = flatEpisodes(seasons)
    const inProgress = flat.filter((x) => lib.progress[x.v.id]).sort((a, b) => lib.progress[b.v.id].at - lib.progress[a.v.id].at)[0]
    if (inProgress) return inProgress
    const lastWatched = flat.reduce((acc, x, i) => (lib.watched[x.v.id] ? i : acc), -1)
    return flat[Math.min(lastWatched + 1, flat.length - 1)] ?? { si: 0, ei: 0, v: undefined }
    // only on open: later progress must not yank focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons.length])

  const [si, setSi] = useState(0)
  const [ei, setEi] = useState(0)
  useEffect(() => {
    setSi(here.si)
    setEi(here.ei)
  }, [here])
  const ep = isSeries ? seasons[si]?.eps[ei] : undefined

  // A series opens on its episodes straight away (they fill in when the meta lands), not on actions first.
  const [mode, setMode] = useState<Mode>(item.type === 'series' ? 'episodes' : 'actions')
  useEffect(() => {
    if (meta !== undefined && item.type === 'series' && !m.videos?.length) setMode('actions')
  }, [meta])

  // Movies fetch at once; series fetch the focused episode after a short rest (prefetch while browsing).
  const [videoId, setVideoId] = useState<string | undefined>(item.type === 'series' ? undefined : item.id)
  useEffect(() => {
    if (item.type === 'series' && meta === undefined) return
    if (!isSeries) return void setVideoId(item.id)
    if (!ep) return
    const t = setTimeout(() => setVideoId(ep.id), mode === 'actions' ? 0 : 600)
    return () => clearTimeout(t)
  }, [ep?.id, isSeries, mode, meta])

  const runtimeMin = parseRuntime(m.runtime)
  const { ranked, bandwidth, measuring, slow, failed, asked, retry } = useStreams(item.type, videoId, runtimeMin)
  const best = ranked?.find(playable)
  const bestDownload = ranked?.filter(downloadable).sort((a, b) => b.keep - a.keep)[0]
  const vid = isSeries ? ep?.id : item.id
  const dl = vid ? lib.downloads[vid] : undefined
  const progress = vid ? lib.progress[vid] : undefined

  const request = (r: Ranked | undefined): PlayRequest | undefined => {
    if (!vid) return
    if (!r) return dl // offline: a download plays from disk
    return playRequest(r, m, ep, ep && nextEpisode(seasons, ep.id), ranked ?? undefined)
  }

  // A pressed before the verdict (cópias still arriving, link being measured) waits for it, then plays the real pick.
  const [queued, setQueued] = useState(false)
  const resolving = !ranked || measuring
  // After an episode is watched to the end, the entry moves on to the next one.
  const justPlayed = useRef<string | null>(null)
  const [nextUp, setNextUp] = useState<string | null>(null)

  const play = (r?: Ranked) => {
    if (!r && !dl && resolving) return setQueued(true)
    r ??= best
    const req = dl ? { ...(request(r) ?? dl), label: dl.label } : request(r)
    if (!req) return
    if (isSeries) justPlayed.current = req.key
    onPlay(req)
  }
  useEffect(() => {
    if (!autoPlay || meta === undefined) return
    setMode('actions')
    setQueued(true)
  }, [meta === undefined])
  useEffect(() => {
    if (!queued || resolving) return
    setQueued(false)
    if (best || dl) play()
  }, [queued, resolving])

  useEffect(() => {
    const id = justPlayed.current
    if (!id || !lib.watched[id]) return
    justPlayed.current = null
    const flat = flatEpisodes(seasons)
    const at = flat.findIndex((x) => x.v.id === id)
    const next = at >= 0 ? flat[at + 1] : undefined
    if (!next) return
    setSi(next.si)
    setEi(next.ei)
    setNextUp(next.v.id)
  }, [lib.watched])
  const download = (r = bestDownload) => {
    if (dl && dl.state === 'downloading') return void kalli.pauseDownload(dl.key)
    if (dl && dl.state !== 'done') return void kalli.resumeDownload(dl.key)
    const req = request(r)
    if (req && r) void kalli.download({ ...req, filename: r.stream.behaviorHints?.filename })
  }

  const [copiesOpen, setCopiesOpen] = useState(false)
  // Series keep the synopsis to two lines beside the episodes; Y reads it in full.
  const [fullSynopsis, setFullSynopsis] = useState(false)

  // Face buttons act directly (A watches, X downloads, Y opens the cópias): no focus to steer first.
  useActions(
    (a) => {
      if (mode === 'episodes') {
        const eps = seasons[si]?.eps ?? []
        if (a === 'left') setEi(Math.max(0, ei - 1))
        if (a === 'right') setEi(Math.min(eps.length - 1, ei + 1))
        if (a === 'lb' && si > 0) (setSi(si - 1), setEi(0))
        if (a === 'rb' && si < seasons.length - 1) (setSi(si + 1), setEi(0))
        if (a === 'a' || a === 'up') setMode('actions')
        if (a === 'x') download()
        if (a === 'y') setFullSynopsis(!fullSynopsis)
        if (a === 'b') onClose()
        return
      }
      if (a === 'a') play()
      if (a === 'x') download()
      if (a === 'y') ranked?.length ? setCopiesOpen(true) : ranked && failed && retry()
      if (a === 'b') isSeries ? setMode('episodes') : onClose()
      if (a === 'down' && isSeries) setMode('episodes')
    },
    active && !copiesOpen
  )

  const credit = credits(m, 4)
  const trailer = m.trailerStreams?.[0]?.ytId

  return (
    <motion.div className="detail" initial={{ opacity: 1 }} exit={{ opacity: 1 }} inert={!active}>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0, scale: 1.08 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {m.background && <img src={sized(m.background, 'large')} alt="" decoding="async" />}
        {/* Never under a playing film (inactive), nor for people who asked for less motion. */}
        {active && trailer && prefs?.settings.trailers && !calm && <Trailer ytId={trailer} />}
      </motion.div>
      <motion.div className="detail-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} />

      <motion.div className="detail-poster" layoutId={`art-${item.id}`} transition={travel}>
        <Cover m={item} size="large" />
      </motion.div>

      <motion.div
        className="detail-info"
        initial={{ opacity: 0, transform: tx('2rem') }}
        animate={{ opacity: 1, transform: tx(0) }}
        exit={{ opacity: 0, transform: tx('1rem'), transition: leave }}
        transition={{ ...settle, delay: 0.12 }}
        inert={copiesOpen}
      >
        {m.logo ? (
          <h1 className="detail-logo-wrap">
            <img className="detail-logo" src={sized(m.logo, 'medium')} alt={m.name} />
          </h1>
        ) : (
          <h1 className="detail-title">{m.name}</h1>
        )}
        <p className="detail-facts">{facts(m, runtimeMin)}</p>
        {m.description && (
          <p className={`detail-synopsis ${isSeries && mode === 'episodes' && !fullSynopsis ? 'is-short' : ''}`}>{m.description}</p>
        )}
        {credit && <p className="detail-credits">{credit}</p>}

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'episodes' ? (
            <Episodes
              key="eps"
              seasons={seasons}
              si={si}
              ei={ei}
              lib={lib}
              loading={meta === undefined}
              fullSynopsis={fullSynopsis}
              onSeason={(i) => (setSi(i), setEi(0))}
              onFocus={setEi}
              onPick={(i) => (setEi(i), setMode('actions'))}
            />
          ) : (
            <motion.div
              key="copy"
              className="copy-block"
              initial={{ opacity: 0, transform: ty('1.5rem') }}
              animate={{ opacity: 1, transform: ty(0) }}
              exit={{ opacity: 0, transform: ty('1rem'), transition: leave }}
              transition={settle}
            >
              {ep && <p className="copy-episode">{episodeLabel(ep)}</p>}
              <div aria-live="polite">
                <CopyLine ranked={ranked} best={best ?? bestDownload} measuring={measuring} dl={dl} slow={slow} failed={failed} asked={asked} queued={queued} />
              </div>
              {/* The machine chooses: two actions. The full list is a hint away, not a peer of Assistir. */}
              <div className="actions" role="toolbar">
                <ActionButton primary btn="A" disabled={!best && !dl && !resolving} onClick={() => play()}>
                  <Play className="ico" />
                  {queued
                    ? 'Começando…'
                    : nextUp && nextUp === ep?.id && !progress
                      ? `Próximo: T${ep.season} E${ep.episode}`
                      : progress
                        ? `Continuar de ${clock(progress.pos)}`
                        : dl?.state === 'done'
                          ? 'Assistir do disco'
                          : dl
                            ? 'Assistir enquanto baixa'
                            : 'Assistir'}
                </ActionButton>
                <ActionButton btn="X" disabled={(!dl && !bestDownload) || dl?.state === 'done'} onClick={() => download()}>
                  {dl?.state === 'downloading' ? <Pause className="ico" /> : dl?.state === 'done' ? <Check className="ico" /> : <DownloadIcon className="ico" />}
                  {dl?.state === 'downloading' ? `Baixando ${percent(dl)}` : dl?.state === 'done' ? 'Baixado' : dl ? `Retomar ${percent(dl)}` : 'Baixar'}
                </ActionButton>
                {ranked && ranked.length > 0 ? (
                  <ActionButton text btn="Y" onClick={() => setCopiesOpen(true)}>
                    Ver cópias <span className="tnum">({ranked.length})</span>
                  </ActionButton>
                ) : (
                  ranked &&
                  failed > 0 && (
                    <ActionButton text btn="Y" onClick={retry}>
                      Tentar de novo
                    </ActionButton>
                  )
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <span className="detail-hints" inert={copiesOpen}>
        {mode === 'episodes' ? (
          <>
            <Hint b={['LB', 'RB']}>Temporada</Hint>
            <Hint b="B">Voltar</Hint>
          </>
        ) : (
          <Hint b="B">{isSeries ? 'Episódios' : 'Voltar'}</Hint>
        )}
      </span>

      <AnimatePresence>
        {copiesOpen && ranked && (
          <Copies
            ranked={ranked}
            bandwidth={bandwidth}
            onClose={() => setCopiesOpen(false)}
            onPlay={(r) => (setCopiesOpen(false), play(r))}
            onDownload={(r) => (setCopiesOpen(false), download(r))}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
