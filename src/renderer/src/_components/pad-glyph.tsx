import { cn } from '../lib/utils.ts'
import { isDir, KEY_INK, type PadButton } from '../pad.ts'
import { DPadGlyph } from './d-pad-glyph.tsx'

/** Face button: a ring with the letter, like the pad's own. Shoulders and center buttons are pills. */
export function PadGlyph({ b, className }: { b: PadButton; className?: string }) {
  if (isDir(b)) return <DPadGlyph arms={[b]} />
  const pill = b.length > 1
  return (
    <svg className={cn('btn-glyph', pill && 'pill', KEY_INK, className)} viewBox={pill ? '0 0 40 24' : '0 0 24 24'} aria-label={b} role="img">
      {pill ? (
        <rect x="1" y="1" width="38" height="22" rx="11" fill="none" stroke="currentColor" strokeWidth="1.75" />
      ) : (
        <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      )}
      <text x={pill ? 20 : 12} y="12.5" textAnchor="middle" dominantBaseline="central" fill="currentColor" fontSize={pill ? 11 : 12} fontWeight="700" fontFamily="Archivo Variable">
        {b}
      </text>
    </svg>
  )
}
