import { pointerMoved } from '../../input.ts'
import { cn } from '../../lib/utils.ts'

/** A step's way forward: the one primary action, filled with the accent while focused. */
export function NextButton({ focused, label, onFocus, onPress }: { focused: boolean; label: string; onFocus: () => void; onPress: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onPress}
      onMouseEnter={() => pointerMoved() && onFocus()}
      className={cn(
        'mt-8 h-[4.6rem] cursor-pointer self-start rounded-[2.3rem] bg-ink/12 px-[1.9rem] text-meta font-[650] transition-[background-color,color,scale] duration-150 ease-out active:scale-96',
        focused && 'bg-edition text-on-edition'
      )}
    >
      {label}
    </button>
  )
}
