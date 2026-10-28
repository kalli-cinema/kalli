import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { MetaPreview } from '../../../shared/types.ts'
import { travel } from '../motion.ts'
import { Cover } from './cover.tsx'

type PosterProps = {
  /** Missing while the catalogue loads: a placeholder holds the slot. */
  m?: MetaPreview
  focused: boolean
  /** The entry opened from this cover has taken its art. */
  hidden: boolean
  className?: string
  style?: CSSProperties
  onClick: () => void
  onHover: () => void
}

// Covers are real buttons (named, clickable) kept out of the Tab order: the D-pad focus model moves between them.
export function Poster(p: PosterProps) {
  if (!p.m) return <div className="poster is-loading" style={p.style} aria-hidden />
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`poster ${p.className ?? ''} ${p.focused ? 'is-focused' : ''}`}
      style={p.style}
      onClick={p.onClick}
      onMouseEnter={p.onHover}
      onMouseMove={p.focused ? undefined : p.onHover}
      aria-label={p.m.name}
      aria-current={p.focused || undefined}
    >
      {/* Only the focused cover carries the shared id: it is the one that becomes the entry. */}
      {!p.hidden && (
        <motion.div className="poster-art" layoutId={p.focused ? `art-${p.m.id}` : undefined} transition={travel}>
          <Cover m={p.m} />
        </motion.div>
      )}
      <span className="focus-mark" aria-hidden />
    </button>
  )
}
