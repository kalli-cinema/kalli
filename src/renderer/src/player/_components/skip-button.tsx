import { SkipForward } from 'lucide-react'
import { motion } from 'motion/react'
import { Btn } from '../../_components/btn.tsx'
import { leave, settle, ty } from '../../motion.ts'

/**
 * "Pular abertura": shown for the whole opening (recap, credits), bottom right where the eye goes. A takes it even
 * while the controls are hidden; the pointer clicks it.
 */
export function SkipButton({ label, onSkip }: { label: string; onSkip: () => void }) {
  return (
    <motion.button
      type="button"
      tabIndex={-1}
      className="player-skip"
      onClick={onSkip}
      initial={{ opacity: 0, transform: ty('1rem') }}
      animate={{ opacity: 1, transform: ty(0) }}
      exit={{ opacity: 0, transition: leave }}
      transition={settle}
    >
      <SkipForward aria-hidden />
      {label}
      <Btn b="A" />
    </motion.button>
  )
}
