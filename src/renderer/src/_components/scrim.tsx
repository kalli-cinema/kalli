import { motion } from 'motion/react'
import { leave } from '../motion.ts'

/**
 * The area outside an open drawer (Ver cópias, Áudio e legendas, Episódios): it dims what's behind a little and a
 * click on it closes the drawer, like B or Esc. Render it right before the drawer, so the drawer sits on top.
 */
export function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      className="drawer-scrim"
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: leave }}
      transition={{ duration: 0.25 }}
      onClick={(e) => (e.stopPropagation(), onClose())}
    />
  )
}
