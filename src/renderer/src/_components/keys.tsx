import type { Key, Pos } from '../keyboard.ts'
import { cn } from '../lib/utils.ts'

// Keys are 4rem tiles on a 7% ivory fill. Focus answers in 150ms: solid yellow, 1.08 forward. A latched key is ivory.
// Command keys read in label style; search keys read as capitals (search ignores case), URL keys in true case.
const KEY = cn(
  'grid h-16 basis-0 cursor-pointer place-items-center rounded-key bg-ink/7 text-body font-[650]',
  'transition-[scale,background-color,color] duration-150 ease-out active:scale-96'
)

/** The on-screen keyboard for the pad (layouts and movement in keyboard.ts). */
export function Keys(p: { rows: Key[][]; pos: Pos | null; upper?: boolean; onPress: (pos: Pos) => void; search?: boolean; className?: string }) {
  return (
    <div className={cn('keyboard flex flex-col gap-2', p.className)} role="group" aria-label="Teclado">
      {p.rows.map((row, r) => (
        <div className="flex gap-2" key={r}>
          {row.map((key, c) => {
            const focused = p.pos?.r === r && p.pos.c === c
            const latched = key.value === 'shift' && p.upper
            return (
              <button
                type="button"
                tabIndex={-1}
                key={key.label}
                className={cn(
                  KEY,
                  key.span > 1 ? 'text-label tracking-[0.06em] uppercase' : p.search && 'uppercase',
                  latched && 'bg-ink text-(--on-ink)',
                  focused && 'scale-108 bg-edition text-on-edition'
                )}
                style={{ flexGrow: key.span }}
                onClick={() => p.onPress({ r, c })}
                aria-pressed={key.value === 'shift' ? !!p.upper : undefined}
              >
                {key.span === 1 && p.upper ? key.label.toUpperCase() : key.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
