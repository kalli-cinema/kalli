import type { Addon } from '../../../../shared/types.ts'
import { AddonLogo } from '../../_components/addon-logo.tsx'
import { Alert } from '../../_components/icons.tsx'
import { addonFacts, sectionName } from '../../format.ts'

/** What an addon brings, read from its manifest, before it is added. */
export function AddonPreview({ addon, installed, busy, error }: { addon: Addon; installed: boolean; busy: boolean; error?: string }) {
  const m = addon.manifest
  const sections = m.catalogs.filter((c) => !c.extra?.some((e) => e.isRequired)).map((c) => sectionName(c.type, c.name))
  return (
    <div className="flex flex-col">
      <p className="text-label font-bold tracking-[0.16em] text-ink-3 uppercase">{installed ? 'Já instalado: adicionar de novo atualiza' : 'Novo addon'}</p>
      <div className="mt-6 flex items-center gap-8">
        <AddonLogo addon={addon} className="size-[8rem] rounded-panel" />
        <div className="min-w-0">
          <h2 className="sheet-title">{m.name}</h2>
          <p className="mt-2 text-meta text-ink-2">{addonFacts(m)}</p>
        </div>
      </div>
      {m.description && <p className="mt-8 line-clamp-5 max-w-[62ch] text-body text-ink-2">{m.description}</p>}
      {sections.length > 0 && (
        <p className="mt-6 max-w-[62ch] text-meta">
          {sections.length === 1 ? 'Uma seção nova' : `${sections.length} seções novas`} na tela inicial: {sections.slice(0, 6).join(', ')}
          {sections.length > 6 && '…'}
        </p>
      )}
      {busy && <p className="mt-6 text-hint text-ink-2">Adicionando…</p>}
      {error && (
        <p className="mt-6 flex items-center gap-2 text-hint text-alert" role="alert">
          <Alert className="ico" /> {error}
        </p>
      )}
    </div>
  )
}
