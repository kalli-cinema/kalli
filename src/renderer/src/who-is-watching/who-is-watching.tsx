import { motion } from 'motion/react'
import { useState } from 'react'
import type { Profile } from '../../../shared/types.ts'
import { Avatar } from '../_components/avatar.tsx'
import { Hint } from '../_components/hint.tsx'
import { pointerMoved, useActions } from '../input.ts'
import { cn } from '../lib/utils.ts'
import { leave, settle, ty } from '../motion.ts'

type WhoProps = { profiles: Profile[]; active: string; onPick: (id: string) => void }

/** At launch with two or more profiles: whoever holds the pad says who is watching. The last one starts focused. */
export function WhoIsWatching({ profiles, active, onPick }: WhoProps) {
  const [i, setI] = useState(() => Math.max(0, profiles.findIndex((p) => p.id === active)))
  useActions((a) => {
    if (a === 'left') setI(Math.max(0, i - 1))
    if (a === 'right') setI(Math.min(profiles.length - 1, i + 1))
    if (a === 'a' || a === 'start') onPick(profiles[i].id)
  })
  return (
    <motion.div className="who" role="dialog" aria-label="Quem vai assistir?" exit={{ opacity: 0, transition: { duration: 0.5, ease: settle.ease } }}>
      <motion.h1 className="who-title" initial={{ opacity: 0, transform: ty('1rem') }} animate={{ opacity: 1, transform: ty(0) }} transition={settle}>
        Quem vai assistir?
      </motion.h1>
      <ol className="who-row">
        {profiles.map((p, j) => (
          <motion.li
            key={p.id}
            initial={{ opacity: 0, transform: ty('1.5rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transition: leave }}
            transition={{ ...settle, delay: 0.08 + j * 0.06 }}
          >
            <button
              type="button"
              tabIndex={-1}
              className={cn('who-person', j === i && 'is-focused')}
              onClick={() => onPick(p.id)}
              onMouseEnter={() => pointerMoved() && setI(j)}
            >
              <Avatar profile={p} className="who-avatar size-[11rem] text-[4.6rem]" />
              <span className="who-name">{p.name}</span>
            </button>
          </motion.li>
        ))}
      </ol>
      <span className="sheet-hints">
        <Hint b={['Left', 'Right']}>Escolher</Hint>
        <Hint b="A">Entrar</Hint>
      </span>
    </motion.div>
  )
}
