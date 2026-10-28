import { Kbd } from '../components/ui/kbd.tsx'
import { cn } from '../lib/utils.ts'
import { ARROW, DIR_NAME, isDir, KEY_INK, KEY_LABEL, type PadButton } from '../pad.ts'

/**
 * A key on a keyboard, drawn as a cap: a lit fill with a dark lower lip, like the key under the finger.
 * The label stays in the hint's own size (never below the 1.3rem floor); arrows are drawn.
 */
export function Keycap({ b }: { b: PadButton }) {
  return (
    <Kbd
      className={cn(
        // Fill tinted from the key's own ink: ivory on the dark room, dark on the yellow primary action.
        'h-[1.45em] min-w-[1.45em] gap-0 rounded-[0.3em] bg-current/16 px-[0.4em] align-middle text-[length:inherit] leading-none font-[650]',
        "shadow-[inset_0_-0.12em_0.06em_rgb(0_0_0/0.45)] [&_svg:not([class*='size-'])]:size-[0.9em]",
        KEY_INK
      )}
      aria-label={isDir(b) ? DIR_NAME[b] : undefined}
    >
      {isDir(b) ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={ARROW[b]} />
        </svg>
      ) : (
        KEY_LABEL[b]
      )}
    </Kbd>
  )
}
