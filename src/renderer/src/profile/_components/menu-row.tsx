import { AddonInfo } from '../../_components/addon-info.tsx'
import { Alert } from '../../_components/icons.tsx'
import { cn } from '../../lib/utils.ts'
import { masked, type Row } from '../rows.ts'
import { Avatar } from '../../_components/avatar.tsx'

type MenuRowProps = {
  row: Row
  focused: boolean
  confirming: boolean
  /** Which press the warning waits for: A (the row's action) or X (its second action). */
  confirmKey?: 'a' | 'x'
  busy: boolean
  error?: string
  onPick: (i: number) => void
}

const NAME = 'text-meta font-[650] group-data-[focused]:text-edition'
const TAG = 'col-start-2 row-start-1 self-center text-label font-bold tracking-[0.12em] text-ink-3 uppercase group-data-[focused]:text-ink-2'
const NOTE = 'col-span-full text-hint text-ink-2'

/** One option of the menu: its label, its value or choices, its note, and the second-A warning or error under it. */
export function MenuRow({ row, focused, confirming, confirmKey = 'a', busy, error, onPick }: MenuRowProps) {
  return (
    <div
      className={cn('group grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 rounded-panel px-5 py-[1.1rem]', focused && 'bg-ink/8')}
      data-focused={focused || undefined}
    >
      {row.kind === 'action' && row.profile ? (
        <span className="flex items-center gap-[1.1rem]">
          <Avatar profile={row.profile} />
          <span className={NAME}>{row.label}</span>
        </span>
      ) : row.kind === 'action' && row.isAddon ? (
        <AddonInfo addon={row.addon} name={row.label} note={row.note} />
      ) : (
        <span className={NAME} id={`row-${row.id}`}>
          {row.label}
        </span>
      )}

      {row.kind === 'action' && (busy || row.tag) && <span className={TAG}>{busy ? 'Aguarde…' : row.tag}</span>}

      {row.kind === 'text' && (
        <span className="col-span-full truncate text-hint text-ink-2">
          {row.value ? (row.secret ? masked(row.value) : row.value) : <span className="text-ink-3">{row.placeholder}</span>}
        </span>
      )}

      {row.kind === 'choice' && (
        <span className="col-span-full flex flex-wrap gap-[0.6rem]" role="radiogroup" aria-labelledby={`row-${row.id}`}>
          {row.options.map((o, k) => (
            <button
              type="button"
              tabIndex={-1}
              key={o}
              role="radio"
              aria-checked={k === row.at}
              onClick={() => onPick(k)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-[0.55rem] rounded-[1.5rem] bg-ink/8 px-[1.2rem] py-[0.6rem] text-hint text-ink-2',
                'transition-[background-color,color] duration-150 ease-out',
                k === row.at && 'bg-ink font-[650] text-(--on-ink)',
                k === row.at && focused && 'bg-edition text-on-edition'
              )}
            >
              {/* The dark ring keeps a swatch visible on a chip filled with its own colour. */}
              {row.images?.[k] && (
                <img src={row.images[k]} alt="" className="-my-[0.3rem] -ml-[0.5rem] size-[2rem] rounded-full bg-edition" draggable={false} />
              )}
              {row.swatches && <span className="size-[1em] rounded-full shadow-[0_0_0_0.12rem_rgb(0_0_0/0.35)]" style={{ background: row.swatches[k] }} />}
              {o}
            </button>
          ))}
        </span>
      )}

      {row.note && !(row.kind === 'action' && row.isAddon) && <span className={NOTE}>{row.note}</span>}

      {row.kind === 'action' && row.progress != null && (
        <span className="col-span-full mt-1 h-[0.22rem] overflow-hidden rounded-art bg-ink/16" aria-hidden>
          <span
            className="block h-full origin-left bg-edition transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${row.progress})` }}
          />
        </span>
      )}

      {(confirming || error) && (
        <span className="col-span-full flex items-center gap-2 text-hint text-alert" role="alert">
          <Alert className="ico" />{' '}
          {error ??
            (confirmKey === 'x' && row.kind === 'action' && row.secondary
              ? `${row.secondary.confirm} Pressione X de novo para ${row.secondary.tag.toLowerCase()}.`
              : `${row.kind === 'action' ? (row.confirm ?? '') : ''} Pressione A de novo para confirmar.`)}
        </span>
      )}
    </div>
  )
}
