import type { ReactNode } from 'react'
import { cn } from '../../lib/utils.ts'

type ControlProps = {
  label: string
  focused: boolean
  onClick: () => void
  onHover: () => void
  children: ReactNode
  /** The round, filled play/pause button. */
  primary?: boolean
  disabled?: boolean
}

/**
 * One player control: an icon in a round hit area. D-pad focus fills it with ink and names it underneath;
 * the pointer gets the same name on hover.
 */
export function Control({ label, focused, onClick, onHover, children, primary, disabled }: ControlProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn('player-control group', primary && 'is-primary', focused && 'is-focused')}
    >
      {children}
      <span className="player-tip" aria-hidden>
        {label}
      </span>
    </button>
  )
}
