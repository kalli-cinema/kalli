import { Check, LoaderCircle } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Video } from '../../../../shared/types.ts'
import { Hint } from '../../_components/hint.tsx'
import { Scrim } from '../../_components/scrim.tsx'
import { useLibrary } from '../../data.ts'
import { minutesLeft } from '../../format.ts'
import { useActions } from '../../input.ts'
import { leave, settle, tx } from '../../motion.ts'
import type { Season } from '../../seasons.ts'
import { cn } from '../../lib/utils.ts'

type EpisodesPanelProps = {
  seasons: Season[]
  playing: string
  starting?: string
  onPick: (v: Video) => void
  onClose: () => void
}

/** The season's episodes beside the picture: LB/RB change season, A plays one (its best cópia), B closes. */
export function EpisodesPanel({ seasons, playing, starting, onPick, onClose }: EpisodesPanelProps) {
  const lib = useLibrary()
  const here = seasons.findIndex((s) => s.eps.some((v) => v.id === playing))
  const [si, setSi] = useState(Math.max(0, here))
  const eps = seasons[si]?.eps ?? []
  const [ei, setEi] = useState(() => Math.max(0, eps.findIndex((v) => v.id === playing)))
  const list = useRef<HTMLUListElement>(null)
  // `void`: Chromium's scrollIntoView returns a Promise, and an effect returning one crashes React (the whole overlay).
  useEffect(() => void list.current?.children[ei]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [ei, si])

  useActions((a) => {
    if (a === 'b' || a === 'x') onClose()
    if (a === 'up') setEi(Math.max(0, ei - 1))
    if (a === 'down') setEi(Math.min(eps.length - 1, ei + 1))
    if (a === 'lb' && si > 0) (setSi(si - 1), setEi(0))
    if (a === 'rb' && si < seasons.length - 1) (setSi(si + 1), setEi(0))
    if (a === 'a' && eps[ei] && eps[ei].id !== playing) onPick(eps[ei])
  })

  return (
    <>
    <Scrim onClose={onClose} />
    <motion.aside
      className="player-panel is-episodes"
      initial={{ opacity: 0, transform: tx('3rem') }}
      animate={{ opacity: 1, transform: tx(0) }}
      exit={{ opacity: 0, transform: tx('2rem'), transition: leave }}
      transition={settle}
      aria-label="Episódios"
    >
      <h2 className="panel-heading">
        {seasons.length > 1 ? (
          <span className="panel-seasons">
            {seasons.map((s, i) => (
              <button key={s.season} type="button" tabIndex={-1} className={cn(i === si && 'is-on')} onClick={() => (setSi(i), setEi(0))}>
                Temporada {s.season}
              </button>
            ))}
          </span>
        ) : (
          `Temporada ${seasons[0]?.season ?? 1}`
        )}
      </h2>
      <ul ref={list} className="panel-episodes">
        {eps.map((v, i) => {
          const p = lib.progress[v.id]
          const now = v.id === playing
          return (
            <li key={v.id}>
              <button
                type="button"
                tabIndex={-1}
                className={cn('panel-episode', i === ei && 'is-focused', now && 'is-now')}
                onClick={() => (setEi(i), !now && onPick(v))}
                onMouseEnter={() => setEi(i)}
              >
                <span className="panel-still">
                  {v.thumbnail && <img src={v.thumbnail} alt="" loading="lazy" decoding="async" />}
                  {lib.watched[v.id] && <Check className="panel-watched" aria-label="Assistido" />}
                  {starting === v.id && <LoaderCircle className="panel-spinner animate-spin" aria-label="Abrindo" />}
                  {p && <span className="panel-meter" style={{ transform: `scaleX(${p.pos / p.dur})` }} />}
                </span>
                <span className="panel-episode-text">
                  <span className="panel-episode-no tnum">
                    E{v.episode}
                    {now ? ' · Assistindo' : p ? ` · ${minutesLeft(p.dur - p.pos)}` : ''}
                  </span>
                  <span className="panel-episode-title">{v.title ?? v.name ?? `Episódio ${v.episode}`}</span>
                  {i === ei && v.overview && <span className="panel-episode-overview">{v.overview}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="panel-hints">
        {seasons.length > 1 && <Hint b={['LB', 'RB']}>Temporada</Hint>}
        <Hint b="A">Assistir</Hint>
        <Hint b="B">Fechar</Hint>
      </p>
    </motion.aside>
    </>
  )
}
