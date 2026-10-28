import { cn } from '../lib/utils.ts'
import { DIR_NAME, KEY_INK, type Dir } from '../pad.ts'

const ARM: Record<Dir, string> = { Up: 'M9 2.5h6v6.5H9z', Down: 'M9 15h6v6.5H9z', Left: 'M2.5 9H9v6H2.5z', Right: 'M15 9h6.5v6H15z' }

/** D-pad with the arms that matter filled. */
export function DPadGlyph({ arms }: { arms: Dir[] }) {
  return (
    <svg className={cn('btn-glyph', KEY_INK)} viewBox="0 0 24 24" role="img" aria-label={arms.map((a) => DIR_NAME[a]).join(' e ')}>
      {(Object.keys(ARM) as Dir[]).map((k) => (
        <path key={k} d={ARM[k]} fill={arms.includes(k) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
