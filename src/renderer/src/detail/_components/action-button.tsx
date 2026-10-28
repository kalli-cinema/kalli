import type { ReactNode } from 'react'
import { Btn } from '../../_components/btn.tsx'
import { Button } from '../../components/ui/button.tsx'
import { cn } from '../../lib/utils.ts'

// coss Button at ten feet: a 4.6rem pill, printed flat (no inset highlight or tinted shadow), the pad glyph leading.
// The `[&_svg:not(...)]` overrides replace coss's own icon sizing and 80% icon opacity, which are set for 16px UI.
const ACTION = cn(
  'h-[4.6rem] gap-[0.75rem] rounded-full border-0 pr-[1.9rem] pl-[1.2rem] text-meta font-[650] shadow-none before:hidden',
  'not-disabled:inset-shadow-none [:active,[data-pressed]]:inset-shadow-none',
  "[&_svg]:mx-0 [&_svg:not([class*='size-'])]:size-[1.15em] [&_svg:not([class*='opacity-'])]:opacity-100",
  'transition-[scale,background-color] duration-150 ease-out hover:scale-104 active:scale-96 disabled:opacity-35'
)

/** The machine chooses: A is the one primary, X the secondary; the text action (Y) carries no fill until the pointer is on it. */
export function ActionButton(p: { btn: 'A' | 'X' | 'Y'; primary?: boolean; text?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      variant={p.primary ? 'default' : p.text ? 'ghost' : 'secondary'}
      className={cn(ACTION, p.text && 'font-normal text-ink-2 hover:scale-100 hover:text-ink')}
      disabled={p.disabled}
      onClick={p.onClick}
      tabIndex={-1}
    >
      <Btn b={p.btn} className={p.text ? 'size-[1.5em]' : 'size-[1.6em]'} />
      <span className="inline-flex items-center gap-[0.55rem]">{p.children}</span>
    </Button>
  )
}
