import { BatteryLow, CircleArrowUp, Download, Gamepad2, TriangleAlert, Unplug, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Notification } from '../../../shared/types.ts'
import { cn } from '../lib/utils.ts'
import { leave, travel, tx } from '../motion.ts'

const kalli = window.kalli

const ICON: Record<Notification['kind'], LucideIcon> = { download: Download, gamepad: Gamepad2, battery: BatteryLow, player: TriangleAlert, update: CircleArrowUp }

type Shown = Notification & { id: number }

/** Errors stay long enough to be read from the couch; the rest just pass by. */
const STAY_MS = 5000
const STAY_ERROR_MS = 9000

let next = 0

/**
 * Notifications from main (downloads, controllers, the player): they slide in at the bottom right, stack up to
 * three, and leave on their own (the player puts them top right, clear of its skip and next-episode cards). A polite live region, so screen readers hear them without being interrupted.
 */
export function Toasts({ top }: { top?: boolean }) {
  const [list, setList] = useState<Shown[]>([])
  useEffect(
    () =>
      kalli.onNotify((n) => {
        const id = ++next
        setList((l) => [...l, { ...n, id }].slice(-3))
        setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), n.error ? STAY_ERROR_MS : STAY_MS)
      }),
    []
  )
  return (
    <ol className={cn('toasts', top && 'is-top')} aria-live="polite">
      <AnimatePresence initial={false}>
        {list.map((n) => {
          const Icon = n.kind === 'gamepad' && n.title.includes('desconectado') ? Unplug : ICON[n.kind]
          return (
            <motion.li
              key={n.id}
              layout="position"
              className={cn('toast', n.error && 'is-error')}
              initial={{ opacity: 0, transform: tx('110%') }}
              animate={{ opacity: 1, transform: tx(0) }}
              exit={{ opacity: 0, transform: tx('2rem'), transition: leave }}
              transition={travel}
            >
              <Icon className="toast-icon" aria-hidden />
              <span className="toast-text">
                <span className="toast-title">{n.title}</span>
                {n.body && <span className="toast-body">{n.body}</span>}
              </span>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}
