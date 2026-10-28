import { ChevronLeft, ListVideo, LoaderCircle, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw, SkipForward, Captions } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { creditsStart, segmentAt, videoSegments, type IntroDb, type Segment } from '../../../../shared/segments.ts'
import { parseRuntime } from '../../../../shared/ranking.ts'
import { MAX_VOLUME, type PlayerCommand, type PlayerView, type Profile } from '../../../../shared/types.ts'
import { Hint } from '../../_components/hint.tsx'
import { refreshLibrary, sized, useLibrary, useMeta } from '../../data.ts'
import { clock, endsAt } from '../../format.ts'
import { press, useActions, useInputMode } from '../../input.ts'
import { cn } from '../../lib/utils.ts'
import { leave, settle } from '../../motion.ts'
import { usePrefs } from '../../prefs.ts'
import { groupSeasons, nextEpisode } from '../../seasons.ts'
import { downloadable, playRequest } from '../../streams.ts'
import { useAfter } from '../_hooks/use-after.ts'
import { useEpisodeStart } from '../_hooks/use-episode-start.ts'
import { Control } from './control.tsx'
import { EndCard, type EndItem } from './end-card.tsx'
import { EpisodesPanel } from './episodes-panel.tsx'
import { NextUp } from './next-up.tsx'
import { SeekBar } from './seek-bar.tsx'
import { SkipButton } from './skip-button.tsx'
import { TracksPanel } from './tracks-panel.tsx'
import { Volume } from './volume.tsx'

const kalli = window.kalli
const run = (c: PlayerCommand) => void kalli.playerDo(c)

/** Controls fade this long after the last press or pointer move, unless paused or a panel is open. */
const HIDE_MS = 3500
const COUNTDOWN = 10
/** Seconds the rewind and forward controls (and ←/→) step. */
const STEP = 5

type Zone = 'top' | 'seek' | 'bar'
type Item = 'back' | 'fullscreen' | 'play' | 'rewind' | 'forward' | 'next' | 'volume' | 'tracks' | 'episodes'
type Panel = 'tracks' | 'episodes' | null

const SKIP_LABEL: Record<Segment['kind'], string> = {
  recap: 'Pular resumo',
  intro: 'Pular abertura',
  credits: 'Pular créditos',
  post: ''
}

type SessionProps = { view: PlayerView; profile: Profile; autoNext: RefObject<number> }

export function Session({ view: v, profile, autoNext }: SessionProps) {
  const req = v.req
  const isSeries = req.type === 'series' && req.key.includes(':')
  const meta = useMeta(req.type, isSeries ? req.metaId : undefined, true)
  const seasons = useMemo(() => groupSeasons(meta?.videos), [meta?.videos])
  const next = isSeries ? nextEpisode(seasons, req.key) : undefined
  const starter = useEpisodeStart(meta, seasons, parseRuntime(meta?.runtime))
  const mode = useInputMode()

  // --- Skippable stretches and the end of the video. ---
  const [db, setDb] = useState<IntroDb | null>(null)
  useEffect(() => void kalli.skips(req.key).then(setDb), [req.key])
  const segs = useMemo(() => videoSegments(v.chapters, v.dur, db), [v.chapters, v.dur, db])
  const creditsAt = v.dur ? creditsStart(segs, v.dur) : Infinity
  const inCredits = v.started && v.pos >= creditsAt
  const seg = segmentAt(segs, v.pos)
  // The post-credits scene still ahead (a film's credits can run on after it).
  const post = segs.find((s) => s.kind === 'post' && s.start >= (seg?.start ?? v.pos))
  // Credits get a skip only from a real segment, and only when nothing better (the next episode) is on offer.
  const skip = seg && seg.kind !== 'post' && (seg.kind !== 'credits' || !next) ? seg : undefined
  const skipLabel = skip?.kind === 'credits' && post ? 'Ir para a cena pós-créditos' : skip && SKIP_LABEL[skip.kind]
  const doSkip = () => {
    if (!skip) return
    if (skip.kind !== 'credits') return run({ kind: 'seek', to: skip.end })
    post ? run({ kind: 'seek', to: post.start }) : quit()
  }

  // --- Leaving: the picture goes to black while main fades the sound out, then mpv quits. ---
  const [closing, setClosing] = useState(false)
  const quit = () => (setClosing(true), run({ kind: 'quit' }))
  // A player that doesn't quit must not leave the screen black.
  useEffect(() => {
    if (!closing) return
    const t = setTimeout(() => setClosing(false), 3000)
    return () => clearTimeout(t)
  }, [closing])

  // Openings and recaps skip themselves for profiles that asked, once each (seeking back into one leaves it be).
  const skipped = useRef(new Set<number>())
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!profile.autoSkip || !skip || skip.kind === 'credits' || skipped.current.has(skip.start)) return
    skipped.current.add(skip.start)
    run({ kind: 'seek', to: skip.end })
    setToast(skip.kind === 'intro' ? 'Abertura pulada' : 'Resumo pulado')
  }, [skip?.start])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // --- Next episode: ranked ahead of time, offered with the credits, started by itself after a countdown. ---
  const [stayForCredits, setStayForCredits] = useState(false)
  useEffect(() => void (next && v.dur && v.pos > creditsAt - 120 && starter.prefetch(next)), [next?.id, v.pos > creditsAt - 120])
  const offerNext = !!next && inCredits && !stayForCredits
  const counting = offerNext && profile.autoNext && autoNext.current < 3 && !starter.starting
  const [left, setLeft] = useState(COUNTDOWN)
  useEffect(() => {
    if (!counting || v.paused) return
    if (left <= 0) {
      autoNext.current++
      return starter.start(next!)
    }
    const t = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [counting, v.paused, left])
  const playNext = () => next && starter.start(next)

  // --- A film's end card: the next of its collection, films like it, a rating. Fetched as the credits near. ---
  const isMovie = req.type === 'movie'
  const film = useAfter(req, isMovie && v.dur > 0 && v.pos > creditsAt - 120)
  const rated = useLibrary().rated[req.metaId]
  const recs = rated === -1 ? [] : (film.after?.recs ?? [])
  const endItems: EndItem[] = [...(film.after?.next ? (['next'] as const) : []), ...recs.map((_, i) => i), 'up', 'down']
  // It waits out a post-credits scene still ahead (the skip button jumps to it meanwhile).
  const offerEnd = isMovie && inCredits && !post && !stayForCredits && !!(film.after?.next || film.after?.recs.length)
  const [endAt, setEndAt] = useState(0)
  const endFocus = endItems[Math.min(endAt, endItems.length - 1)]
  const rate = (value: 1 | -1) => void kalli.rate(req.metaId, rated === value ? 0 : value).then(refreshLibrary)
  const pickEnd = (item: EndItem) => {
    if (item === 'next') return film.start()
    if (item === 'up' || item === 'down') return rate(item === 'up' ? 1 : -1)
    const m = recs[item]
    if (!m) return
    setClosing(true)
    run({ kind: 'open', meta: { id: m.id, type: m.type, name: m.name, poster: m.poster, background: m.background } })
  }

  // --- Download ahead: the next episode's best cópia arrives while this one plays (main pauses it whenever this
  // video's buffer runs short), so it opens at once and at full quality. Ranked once this video has a lead. ---
  const ahead = usePrefs()?.settings.ahead
  const lead = v.started && v.ahead >= 90
  useEffect(() => void (ahead && next && lead && starter.prefetch(next)), [ahead, next?.id, lead])
  const fetched = starter.ranking?.episode.id === next?.id ? starter.ranking : undefined
  const keeper = fetched?.ranked.filter(downloadable).sort((a, b) => b.keep - a.keep)[0]
  useEffect(() => {
    if (!ahead || !next || !keeper || !meta) return
    const req = playRequest(keeper, meta, next, nextEpisode(seasons, next.id))
    void kalli.download({ ...req, filename: keeper.stream.behaviorHints?.filename, ahead: true }).catch(() => {})
  }, [keeper?.stream, next?.id])

  // --- Controls: shown on any press or pointer move, hidden again while playing. ---
  const [shown, setShown] = useState(true)
  const [panel, setPanel] = useState<Panel>(null)
  const [woke, setWoke] = useState(0)
  const wake = () => (setShown(true), setWoke((n) => n + 1))
  useEffect(() => {
    if (!shown || v.paused || panel || !v.started) return
    const t = setTimeout(() => setShown(false), HIDE_MS)
    return () => clearTimeout(t)
  }, [shown, v.paused, panel, woke, v.started])

  const top: Item[] = ['back', 'fullscreen']
  const bar: Item[] = ['play', 'rewind', 'forward', ...(next ? (['next'] as Item[]) : []), 'volume', 'tracks', ...(isSeries ? (['episodes'] as Item[]) : [])]
  const [focus, setFocus] = useState<{ zone: Zone; i: number }>({ zone: 'bar', i: 0 })
  const items = focus.zone === 'top' ? top : focus.zone === 'bar' ? bar : []
  const at = Math.min(focus.i, Math.max(0, items.length - 1))
  // The focus ring follows the D-pad and arrow keys; a moving pointer hides it (hover speaks for itself then).
  const [pointing, setPointing] = useState(false)
  const isFocused = (zone: Zone, item: Item) => !pointing && focus.zone === zone && items[at] === item
  const hover = (zone: Zone, item: Item) => () => setFocus({ zone, i: (zone === 'top' ? top : bar).indexOf(item) })

  // A big glyph answers a pause or play press in the middle of the picture.
  const [flash, setFlash] = useState<{ n: number; paused: boolean } | null>(null)
  const togglePause = () => {
    setFlash((f) => ({ n: (f?.n ?? 0) + 1, paused: !v.paused }))
    run({ kind: 'pause' })
  }
  const seekBy = (by: number) => run({ kind: 'skip', by })
  // Quick presses add up: each steps from the last volume asked for, not the one mpv has reported back yet.
  const asked = useRef<number | null>(null)
  useEffect(() => void (asked.current === v.volume && (asked.current = null)), [v.volume])
  const volumeBy = (by: number) => {
    const to = Math.max(0, Math.min(MAX_VOLUME, (asked.current ?? v.volume) + by))
    asked.current = to
    run({ kind: 'volume', to })
  }
  const chapter = (dir: 1 | -1) => {
    const times = v.chapters.map((c) => c.time)
    if (!times.length) return seekBy(dir * 60)
    const to = dir > 0 ? times.find((t) => t > v.pos + 1) : times.filter((t) => t < v.pos - 3).at(-1)
    if (to != null) run({ kind: 'seek', to })
  }
  const activate = (item: Item) => {
    if (item === 'back') quit()
    if (item === 'fullscreen') run({ kind: 'fullscreen' })
    if (item === 'play') togglePause()
    if (item === 'rewind') seekBy(-STEP)
    if (item === 'forward') seekBy(STEP)
    if (item === 'next') playNext()
    if (item === 'volume') run({ kind: 'mute' })
    if (item === 'tracks') setPanel('tracks')
    if (item === 'episodes') setPanel('episodes')
  }

  useActions((a) => {
    autoNext.current = 0
    // The end card keeps the D-pad, A and B for itself, without raising the controls over it.
    if (offerEnd && (a === 'left' || a === 'right' || a === 'a' || a === 'b')) {
      film.clearError()
      const i = endItems.indexOf(endFocus)
      if (a === 'left') return setEndAt(Math.max(0, i - 1))
      if (a === 'right') return setEndAt(Math.min(endItems.length - 1, i + 1))
      return a === 'a' ? pickEnd(endFocus) : setStayForCredits(true)
    }
    setPointing(false)
    starter.clearError()
    const wasShown = shown
    wake()
    // While the credits card shows, A watches the next one and B stays for the credits (as its hints say).
    if (offerNext && (a === 'a' || a === 'b')) return a === 'a' ? playNext() : setStayForCredits(true)
    if (a === 'b') return quit()
    if (a === 'lt') return volumeBy(-5)
    if (a === 'rt') return volumeBy(5)
    if (a === 'lb' || a === 'rb') return chapter(a === 'lb' ? -1 : 1)
    if (a === 'y') return setPanel('tracks')
    if (a === 'x' && isSeries) return setPanel('episodes')
    if (a === 'back') return run({ kind: 'fullscreen' })
    if (!wasShown) {
      if (a === 'a') skip ? doSkip() : togglePause()
      if (a === 'left' || a === 'right') (seekBy(a === 'left' ? -STEP : STEP), setFocus({ zone: 'seek', i: 0 }))
      if (a === 'up' || a === 'down') setFocus({ zone: 'bar', i: 0 })
      return
    }
    if (focus.zone === 'seek') {
      if (a === 'left' || a === 'right') seekBy(a === 'left' ? -STEP : STEP)
      if (a === 'a') togglePause()
      if (a === 'up') setFocus({ zone: 'top', i: 0 })
      if (a === 'down') setFocus({ zone: 'bar', i: 0 })
      return
    }
    if (a === 'left') setFocus({ zone: focus.zone, i: Math.max(0, at - 1) })
    if (a === 'right') setFocus({ zone: focus.zone, i: Math.min(items.length - 1, at + 1) })
    if (a === 'up' && focus.zone === 'bar') setFocus({ zone: 'seek', i: 0 })
    if (a === 'down' && focus.zone === 'top') setFocus({ zone: 'seek', i: 0 })
    if (a === 'a') activate(items[at])
  }, !panel && !v.cinema)

  // F toggles fullscreen from the keyboard, like every other player (F11 is caught in main, src/main/overlay.ts);
  // + and - step the volume like LT/RT, up to 200%.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f') (e.preventDefault(), run({ kind: 'fullscreen' }))
      if (e.key === '+' || e.key === '=') (e.preventDefault(), press('rt'))
      if (e.key === '-') (e.preventDefault(), press('lt'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [show, ...rest] = req.title.split(' · ')
  const episode = rest.join(' · ')
  // The cinema question stands alone over the first frame.
  const chrome = !v.cinema && (shown || !v.started)
  const remaining = Math.max(0, v.dur - v.pos)

  return (
    <div className={cn('player', !chrome && !v.cinema && 'is-idle')}onPointerMove={(e) => (e.movementX || e.movementY) && (setPointing(true), wake())}>
      {/* The picture itself: a click pauses, a double click goes fullscreen. */}
      <div
        className="player-stage"
        onClick={() => v.started && togglePause()}
        onDoubleClick={() => (togglePause(), run({ kind: 'fullscreen' }))}
      />

      <AnimatePresence>
        {!v.started && (
          // The first frame rises out of the dark, as the sound fades up with it (main).
          <motion.div className="player-loading" initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.4, ease: settle.ease } }}>
            {req.background && <img src={sized(req.background, 'large')} alt="" decoding="async" />}
            <div className="player-loading-text">
              <LoaderCircle className="player-loading-spinner animate-spin" aria-hidden />
              <p className="player-loading-title">{show}</p>
              {episode && <p className="player-loading-episode">{episode}</p>}
              <p className="player-loading-status" role="status">
                {req.torrent ? 'Procurando fontes do torrent…' : 'Abrindo a cópia…'} <span className="text-ink-3">{req.label}</span>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {v.started && v.buffering && (
        <div className="player-buffering" role="status" aria-label="Carregando">
          <LoaderCircle className="animate-spin" aria-hidden />
        </div>
      )}

      <AnimatePresence>
        {flash && (
          <motion.span
            key={flash.n}
            className="player-flash"
            initial={{ opacity: 0.9, transform: 'scale(0.8)' }}
            animate={{ opacity: 0, transform: 'scale(1.25)' }}
            transition={{ duration: 0.6, ease: settle.ease }}
            onAnimationComplete={() => setFlash(null)}
            aria-hidden
          >
            {flash.paused ? <Pause /> : <Play />}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chrome && (
          <motion.div
            className="player-chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
            transition={{ duration: 0.2 }}
          >
            <header className="player-top">
              <Control label="Sair" focused={isFocused('top', 'back')} onClick={quit} onHover={hover('top', 'back')}>
                <ChevronLeft />
              </Control>
              <div className="player-heading">
                <h1 className="player-title">{show}</h1>
                {episode && <p className="player-episode">{episode}</p>}
              </div>
              {v.started && v.dur > 0 && <span className="player-ends tnum">{endsAt(remaining)}</span>}
              <Control
                label={v.fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                focused={isFocused('top', 'fullscreen')}
                onClick={() => run({ kind: 'fullscreen' })}
                onHover={hover('top', 'fullscreen')}
              >
                {v.fullscreen ? <Minimize /> : <Maximize />}
              </Control>
            </header>

            {v.started && (
              <footer className="player-bottom">
                <div className="player-timeline">
                  <span className="player-time tnum">{clock(v.pos)}</span>
                  <SeekBar
                    pos={v.pos}
                    dur={v.dur}
                    ahead={v.ahead}
                    segments={segs.filter((s) => s.kind !== 'post')}
                    chapters={v.chapters.map((c) => c.time).filter((t) => t > 0)}
                    focused={!pointing && focus.zone === 'seek'}
                    onSeek={(to) => run({ kind: 'seek', to })}
                    onHover={() => setFocus({ zone: 'seek', i: 0 })}
                  />
                  <span className="player-time tnum">-{clock(remaining)}</span>
                </div>
                <div className="player-bar">
                  <Control label={v.paused ? 'Assistir' : 'Pausar'} primary focused={isFocused('bar', 'play')} onClick={togglePause} onHover={hover('bar', 'play')}>
                    {v.paused ? <Play /> : <Pause />}
                  </Control>
                  <Control label="Voltar 5 s" focused={isFocused('bar', 'rewind')} onClick={() => seekBy(-STEP)} onHover={hover('bar', 'rewind')}>
                    <RotateCcw />
                  </Control>
                  <Control label="Avançar 5 s" focused={isFocused('bar', 'forward')} onClick={() => seekBy(STEP)} onHover={hover('bar', 'forward')}>
                    <RotateCw />
                  </Control>
                  {next && (
                    <Control label="Próximo episódio" focused={isFocused('bar', 'next')} onClick={playNext} onHover={hover('bar', 'next')}>
                      {starter.starting?.id === next.id ? <LoaderCircle className="animate-spin" /> : <SkipForward />}
                    </Control>
                  )}
                  <Volume
                    volume={v.volume}
                    muted={v.muted}
                    focused={isFocused('bar', 'volume')}
                    onMute={() => run({ kind: 'mute' })}
                    onVolume={(to) => run({ kind: 'volume', to })}
                    onHover={hover('bar', 'volume')}
                  />
                  <span className="grow" />
                  {mode === 'pad' && (
                    <span className="player-hints">
                      <Hint b={['LT', 'RT']}>Volume</Hint>
                      <Hint b="B">Sair</Hint>
                    </span>
                  )}
                  <Control label="Áudio e legendas" focused={isFocused('bar', 'tracks')} onClick={() => setPanel('tracks')} onHover={hover('bar', 'tracks')}>
                    <Captions />
                  </Control>
                  {isSeries && (
                    <Control label="Episódios" focused={isFocused('bar', 'episodes')} onClick={() => setPanel('episodes')} onHover={hover('bar', 'episodes')}>
                      <ListVideo />
                    </Control>
                  )}
                </div>
              </footer>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('player-corner', chrome && 'is-raised')}>
        <AnimatePresence>
          {skipLabel && !offerNext && !offerEnd && <SkipButton key={skip!.start} label={skipLabel} onSkip={doSkip} />}
          {offerEnd && (
            <EndCard
              key="end"
              film={show}
              next={film.after?.next}
              recs={recs}
              rated={rated}
              focus={endFocus}
              starting={film.starting}
              onFocus={(item) => setEndAt(endItems.indexOf(item))}
              onPick={pickEnd}
            />
          )}
          {offerNext && (
            <NextUp
              key="next"
              next={next!}
              countdown={counting ? left : undefined}
              total={COUNTDOWN}
              starting={!!starter.starting}
              onPlay={playNext}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(toast || starter.error || film.error) && (
          <motion.p
            key={toast ?? starter.error ?? film.error}
            className={cn('player-toast', (starter.error || film.error) && 'is-error')}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: leave }}
          >
            {starter.error ?? film.error ?? toast}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel === 'tracks' && (
          <TracksPanel
            audio={v.audio}
            subs={v.subs}
            sound={v.sound}
            onAudio={(id) => run({ kind: 'audio', id })}
            onSub={(id) => run({ kind: 'sub', id })}
            onSound={(mode) => run({ kind: 'sound', mode })}
            onClose={() => (setPanel(null), wake())}
          />
        )}
        {panel === 'episodes' && (
          <EpisodesPanel
            seasons={seasons}
            playing={req.key}
            starting={starter.starting?.id}
            onPick={(ep) => starter.start(ep)}
            onClose={() => (setPanel(null), wake())}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {closing && (
          <motion.div
            className="player-curtain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: settle.ease }}
            aria-hidden
          />
        )}
      </AnimatePresence>
    </div>
  )
}
