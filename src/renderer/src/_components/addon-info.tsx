import type { Addon } from '../../../shared/types.ts'
import { addonFacts } from '../format.ts'
import { AddonLogo } from './addon-logo.tsx'

/** An addon at a glance: its logo, name and what it brings. `addon` is missing while its manifest loads. */
export function AddonInfo({ addon, name, note }: { addon?: Addon; name: string; note?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-[1.1rem]">
      <AddonLogo addon={addon} />
      <span className="flex min-w-0 flex-col">
        {/* Inside a focusable row (`group`, `data-focused`), the name turns to the accent. */}
        <span className="truncate text-meta font-[650] group-data-[focused]:text-edition">{name}</span>
        <span className="truncate text-hint text-ink-2">{note ?? (addon ? addonFacts(addon.manifest) : 'Carregando…')}</span>
      </span>
    </span>
  )
}
