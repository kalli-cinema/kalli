import { LoaderCircle, Play, ThumbsDown, ThumbsUp } from 'lucide-react'
import { motion } from 'motion/react'
import type { Meta } from '../../../../shared/types.ts'
import { Cover } from '../../_components/cover.tsx'
import { Hint } from '../../_components/hint.tsx'
import { sized } from '../../data.ts'
import { cn } from '../../lib/utils.ts'
import { leave, settle, ty } from '../../motion.ts'
import { Control } from './control.tsx'

/** What the D-pad rests on: the next film, a recommendation (its index), or a rating. */
export type EndItem = 'next' | number | 'up' | 'down'

type EndCardProps = {
  /** The film that just ended. */
  film: string
  next?: Meta
  recs: Meta[]
  rated?: 1 | -1
  focus: EndItem
  starting: boolean
  onFocus: (item: EndItem) => void
  onPick: (item: EndItem) => void
}

/**
 * A film's credits: the next film of its collection (A plays it), films like it (A opens its page once this one
 * closes) and a 👍 / 👎 that keeps a disliked film and what it suggests out of later cards.
 */
export function EndCard({ film, next, recs, rated, focus, starting, onFocus, onPick }: EndCardProps) {
  const hint = focus === 'next' ? 'Assistir' : typeof focus === 'number' ? 'Ver o filme' : 'Avaliar'
  return (
    <motion.section
      className="end-card"
      aria-live="polite"
      initial={{ opacity: 0, transform: ty('1.5rem') }}
      animate={{ opacity: 1, transform: ty(0) }}
      exit={{ opacity: 0, transition: leave }}
      transition={settle}
    >
      <div className="end-row">
        {next && (
          <div className="end-group">
            <p className="end-kicker">Próximo da coleção</p>
            <button
              type="button"
              tabIndex={-1}
              className={cn('end-tile is-still', focus === 'next' && 'is-focused')}
              onClick={() => onPick('next')}
              onMouseEnter={() => onFocus('next')}
              aria-label={`Assistir ${next.name}`}
            >
              <span className="end-art">
                {next.background && <img src={sized(next.background, 'medium')} alt="" decoding="async" />}
                <span className="end-play">{starting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Play aria-hidden />}</span>
              </span>
              <span className="focus-mark" aria-hidden />
            </button>
            <p className="end-name">{next.name}</p>
          </div>
        )}
        {recs.length > 0 && (
          <div className="end-group">
            <p className="end-kicker">Porque você viu {film}</p>
            <div className="end-posters">
              {recs.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  tabIndex={-1}
                  className={cn('end-tile is-poster', focus === i && 'is-focused')}
                  onClick={() => onPick(i)}
                  onMouseEnter={() => onFocus(i)}
                  aria-label={m.name}
                >
                  <span className="end-art">
                    <Cover m={m} size="small" />
                  </span>
                  <span className="focus-mark" aria-hidden />
                </button>
              ))}
            </div>
            <p className="end-name">{typeof focus === 'number' ? recs[focus]?.name : ' '}</p>
          </div>
        )}
      </div>
      <div className="end-foot">
        <span className="end-rate">
          Gostou?
          <Control label="Gostei" focused={focus === 'up'} onClick={() => onPick('up')} onHover={() => onFocus('up')}>
            <ThumbsUp className={cn(rated === 1 && 'fill-current')} />
          </Control>
          <Control label="Não é pra mim" focused={focus === 'down'} onClick={() => onPick('down')} onHover={() => onFocus('down')}>
            <ThumbsDown className={cn(rated === -1 && 'fill-current')} />
          </Control>
        </span>
        <span className="end-hints">
          <Hint b="A">{hint}</Hint>
          <Hint b="B">Ver créditos</Hint>
        </span>
      </div>
    </motion.section>
  )
}
