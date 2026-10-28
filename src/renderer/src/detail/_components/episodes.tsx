import { motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { Hint } from '../../_components/hint.tsx'
import { useWheelStep } from '../../_hooks/use-wheel-step.ts'
import { Tabs, TabsList, TabsPanel, TabsTab } from '../../components/ui/tabs.tsx'
import type { Library } from '../../data.ts'
import { pointerMoved } from '../../input.ts'
import { cn } from '../../lib/utils.ts'
import { leave, settle, travel, tx, ty } from '../../motion.ts'
import type { Season } from '../../seasons.ts'
import { EpisodeCard } from './episode-card.tsx'

// Label style, tracked uppercase; the indicator is the 0.2rem underline, 0.55rem under the baseline,
// sliding to the new season on the one ease in 200ms.
const SEASONS = cn(
  'gap-x-8 text-ink-3 transition-[translate] duration-200 ease-out data-[orientation=horizontal]:py-0 *:data-[slot=tabs-tab]:hover:bg-transparent',
  '*:data-[slot=tab-indicator]:h-[0.2rem]! *:data-[slot=tab-indicator]:translate-y-0! *:data-[slot=tab-indicator]:rounded-full *:data-[slot=tab-indicator]:ease-out!'
)
const SEASON = cn(
  'h-auto grow-0 rounded-none border-0 px-0 pb-[0.5rem] text-label leading-none font-bold tracking-[0.12em] uppercase',
  'text-ink-3 transition-colors duration-150 ease-out hover:text-ink-2 data-active:text-edition'
)

type EpisodesProps = {
  seasons: Season[]
  si: number
  ei: number
  lib: Library
  loading: boolean
  fullSynopsis: boolean
  onSeason: (si: number) => void
  onFocus: (ei: number) => void
  onPick: (ei: number) => void
}

/** Season tabs (LB/RB) over a sliding episode track (left/right). */
export function Episodes(p: EpisodesProps) {
  const { seasons, si, ei, lib } = p
  const eps = seasons[si]?.eps ?? []
  const focused = eps[ei]
  const onWheel = useWheelStep((dir) => p.onFocus(Math.max(0, Math.min(eps.length - 1, ei + dir))))
  // More seasons than fit: the strip stays put while the current one is in view, and otherwise slides so the
  // previous season sits beside it, the way the episode track keeps one episode of context.
  const strip = useRef<HTMLDivElement>(null)
  const [stripX, setStripX] = useState(0)
  useLayoutEffect(() => {
    const tabs = strip.current?.querySelectorAll<HTMLElement>('[data-slot=tabs-tab]')
    const tab = tabs?.[si]
    if (!tab) return
    const room = strip.current!.parentElement!.clientWidth
    setStripX((at) =>
      tab.offsetLeft >= at && tab.offsetLeft + tab.offsetWidth <= at + room ? at : si > 0 ? tabs![si - 1].offsetLeft : 0
    )
  }, [si, seasons.length, p.loading])
  if (p.loading) return <p className="copy-verdict episodes-note">Carregando episódios…</p>
  return (
    <motion.div
      className="episodes"
      initial={{ opacity: 0, transform: ty('1.5rem') }}
      animate={{ opacity: 1, transform: ty(0) }}
      exit={{ opacity: 0, transform: ty('1rem'), transition: leave }}
      transition={settle}
      onWheel={onWheel}
    >
      {/* Announces the focused episode as the D-pad moves; the strip itself is visual. */}
      <p className="sr-only" aria-live="polite">
        {focused &&
          `Temporada ${focused.season}, episódio ${focused.episode}${focused.title || focused.name ? `: ${focused.title ?? focused.name}` : ''}${lib.watched[focused.id] ? ', assistido' : lib.progress[focused.id] ? ', em andamento' : ''}`}
      </p>
      {/* Seasons are coss tabs driven by LB/RB: the current one is yellow and its underline travels to it,
          so the eye follows the move instead of hunting for the new mark. */}
      <Tabs value={si} onValueChange={(v) => p.onSeason(v as number)} className="gap-0">
        <TabsList ref={strip} variant="underline" aria-label="Temporadas" className={SEASONS} style={{ translate: `${-stripX}px 0` }}>
          {seasons.map((s, i) => (
            <TabsTab key={s.season} value={i} tabIndex={-1} className={SEASON}>
              {s.season === 0 ? 'Especiais' : `Temporada ${s.season}`}
            </TabsTab>
          ))}
        </TabsList>
        <TabsPanel value={si} tabIndex={-1}>
          <motion.div className="episode-track" animate={{ transform: tx(`${-Math.max(0, ei - 1) * 19.25}rem`) }} transition={travel}>
            {eps.map((v, i) => (
              <EpisodeCard
                key={v.id}
                v={v}
                focused={i === ei}
                progress={lib.progress[v.id]}
                watched={!!lib.watched[v.id]}
                download={lib.downloads[v.id]}
                onPick={() => p.onPick(i)}
                onHover={() => pointerMoved() && p.onFocus(i)}
              />
            ))}
          </motion.div>
        </TabsPanel>
      </Tabs>
      <p className="episodes-hints">
        <Hint b="A">Escolher</Hint>
        <Hint b="X">Baixar</Hint>
        <Hint b="Y">{p.fullSynopsis ? 'Recolher sinopse' : 'Sinopse completa'}</Hint>
        <Hint b={['Left', 'Right']}>Episódios</Hint>
      </p>
    </motion.div>
  )
}
