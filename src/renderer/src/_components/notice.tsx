import { AnimatePresence, motion } from 'motion/react'
import { leave, settle, ty } from '../motion.ts'
import { Alert } from './icons.tsx'

/** Stable live region: rendered empty first, so the error is announced when its text arrives. */
export function Notice({ error }: { error: string | null }) {
  return (
    <div role="alert" className="notice-region">
      <AnimatePresence>
        {error && (
          <motion.p
            className="notice"
            initial={{ opacity: 0, transform: ty('1rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transition: leave }}
            transition={{ duration: 0.4, ease: settle.ease }}
          >
            <Alert className="notice-icon" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
