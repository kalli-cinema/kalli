import { LoaderCircle, Play } from 'lucide-react'
import { motion } from 'motion/react'
import type { Video } from '../../../../shared/types.ts'
import { Hint } from '../../_components/hint.tsx'
import { episodeLabel } from '../../format.ts'
import { leave, settle, ty } from '../../motion.ts'

type NextUpProps = {
  next: Video
  /** Seconds until it starts by itself; undefined when it waits for a press. */
  countdown?: number
  /** Total of the countdown, for the ring. */
  total: number
  starting: boolean
  onPlay: () => void
}

/**
 * The credits are rolling: the next episode, its still and a countdown ring. A starts it now, B stays for the credits.
 * The ring drains with CSS from the moment it shows, so it never stutters on a slow tick.
 */
export function NextUp({ next, countdown, total, starting, onPlay }: NextUpProps) {
  return (
    <motion.section
      className="next-up"
      aria-live="polite"
      initial={{ opacity: 0, transform: ty('1.5rem') }}
      animate={{ opacity: 1, transform: ty(0) }}
      exit={{ opacity: 0, transition: leave }}
      transition={settle}
    >
      <button type="button" tabIndex={-1} className="next-up-still" onClick={onPlay} aria-label="Assistir o próximo episódio">
        {next.thumbnail && <img src={next.thumbnail} alt="" decoding="async" />}
        <span className="next-up-play">
          {starting ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : (
            <>
              {countdown != null && (
                <svg className="next-up-ring" viewBox="0 0 48 48" aria-hidden>
                  <circle cx="24" cy="24" r="22" style={{ animationDuration: `${total}s` }} />
                </svg>
              )}
              <Play aria-hidden />
            </>
          )}
        </span>
      </button>
      <div className="next-up-text">
        <p className="next-up-kicker">
          {starting ? 'Abrindo o próximo episódio…' : countdown != null ? `Próximo episódio em ${Math.ceil(countdown)}` : 'Próximo episódio'}
        </p>
        <p className="next-up-title">{episodeLabel(next)}</p>
        <p className="next-up-hints">
          {/* Clickable hints press A or B, which the player turns into onPlay / onDismiss. */}
          <Hint b="A">Assistir agora</Hint>
          <Hint b="B">Ver créditos</Hint>
        </p>
      </div>
    </motion.section>
  )
}
