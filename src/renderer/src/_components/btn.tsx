import { useInputMode } from '../input.ts'
import type { PadButton } from '../pad.ts'
import { Keycap } from './keycap.tsx'
import { PadGlyph } from './pad-glyph.tsx'

/** The button for whichever device is in use: pad faces after a pad press, keys after a key, click or mouse move. */
export function Btn({ b, className }: { b: PadButton; className?: string }) {
  return useInputMode() === 'pad' ? <PadGlyph b={b} className={className} /> : <Keycap b={b} />
}
