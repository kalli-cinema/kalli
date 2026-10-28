import { Check, Link } from 'lucide-react'
import type { Addon } from '../../../../shared/types.ts'
import { AddonInfo } from '../../_components/addon-info.tsx'
import { pointerMoved } from '../../input.ts'
import { cn } from '../../lib/utils.ts'
import { NextButton } from './next-button.tsx'

type StepAddonsProps = { addons: Addon[] | null; off: Set<string>; at: number; busy: boolean; onFocus: (i: number) => void; onAct: (i: number) => void }

const ROW = 'group flex cursor-pointer items-center gap-6 rounded-panel px-5 py-[0.8rem]'
const TICK = 'grid size-[2.2rem] flex-none place-items-center rounded-full shadow-[inset_0_0_0_0.15rem_var(--ink-3)] transition-[background-color] duration-150 ease-out'

/** Step 2, Fontes: the addons that come installed (A unticks one), and any other Stremio addon by link. */
export function StepAddons({ addons, off, at, busy, onFocus, onAct }: StepAddonsProps) {
  const n = addons?.length ?? 0
  const item = (k: number) => ({
    className: cn(ROW, k === at && 'bg-ink/8'),
    'data-focused': k === at || undefined,
    onClick: () => (onFocus(k), onAct(k)),
    onMouseEnter: () => pointerMoved() && onFocus(k)
  })
  return (
    <>
      <h2 className="sheet-title">De onde vêm os filmes</h2>
      <p className="sheet-sub">
        Já vêm instalados o catálogo, os detalhes de cada título e as legendas. Outros addons do Stremio entram por link, aqui ou depois em Perfil → Addons.
      </p>
      {!addons ? (
        <p className="mt-8 px-5 text-body text-ink-2" role="status">
          Preparando as fontes…
        </p>
      ) : (
        <ol className="mt-8 flex flex-col">
          {addons.map((a, k) => {
            const on = !off.has(a.transportUrl)
            return (
              <li key={a.transportUrl} {...item(k)} role="checkbox" aria-checked={on}>
                <span className={cn(TICK, on && 'bg-ink text-(--on-ink) shadow-none', on && k === at && 'bg-edition text-on-edition')}>
                  {on && <Check className="size-[1.4rem]" strokeWidth={2.25} aria-hidden />}
                </span>
                <AddonInfo addon={a} name={a.manifest.name} />
              </li>
            )
          })}
          <li {...item(n)}>
            <span className={cn(TICK, 'text-ink-2', n === at && 'bg-edition text-on-edition shadow-none')}>
              <Link className="size-[1.3rem]" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-meta font-[650] group-data-[focused]:text-edition">Adicionar por link</span>
              <span className="text-hint text-ink-2">O link do manifest.json de qualquer addon do Stremio.</span>
            </span>
          </li>
          <li>
            <NextButton focused={at === n + 1} label={busy ? 'Aguarde…' : 'Continuar'} onFocus={() => onFocus(n + 1)} onPress={() => onAct(n + 1)} />
          </li>
        </ol>
      )}
    </>
  )
}
