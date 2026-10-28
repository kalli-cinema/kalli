import type { ReactNode } from 'react'
import { press, useInputMode } from '../input.ts'
import { cn } from '../lib/utils.ts'
import { isDir, PAD_ACTION, type PadButton } from '../pad.ts'
import { DPadGlyph } from './d-pad-glyph.tsx'
import { Keycap } from './keycap.tsx'
import { PadGlyph } from './pad-glyph.tsx'

const HINT = 'hint inline-flex items-center gap-[0.45rem] whitespace-nowrap'
// With a keyboard or mouse a hint is a real control: it brightens under the pointer and gives under the press.
const CLICKABLE = 'cursor-pointer transition-[color,scale] duration-150 ease-out hover:text-ink active:scale-96'

/**
 * A hint: the key(s) and what they do. With a keyboard or mouse every key in it is clickable and acts exactly
 * like pressing it; with the pad it's a plain label (nobody clicks with a pad).
 */
export function Hint({ b, children }: { b: PadButton | PadButton[]; children?: ReactNode }) {
  const mode = useInputMode()
  const keys = Array.isArray(b) ? b : [b]
  const label = children != null && <span>{children}</span>
  if (mode === 'pad') {
    const dirs = keys.filter(isDir)
    return (
      <span className={HINT}>
        {dirs.length > 1 ? <DPadGlyph arms={dirs} /> : <span className="inline-flex gap-[0.2rem]">{keys.map((k) => <PadGlyph key={k} b={k} />)}</span>}
        {label}
      </span>
    )
  }
  if (keys.length === 1)
    return (
      <button type="button" tabIndex={-1} className={cn(HINT, CLICKABLE)} onClick={() => press(PAD_ACTION[keys[0]])}>
        <Keycap b={keys[0]} />
        {label}
      </button>
    )
  return (
    <span className={HINT}>
      <span className="inline-flex gap-[0.2rem]">
        {keys.map((k) => (
          <button type="button" tabIndex={-1} key={k} className={cn('inline-flex', CLICKABLE)} onClick={() => press(PAD_ACTION[k])}>
            <Keycap b={k} />
          </button>
        ))}
      </span>
      {label}
    </span>
  )
}
