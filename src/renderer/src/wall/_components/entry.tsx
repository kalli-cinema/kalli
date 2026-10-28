import { AnimatePresence, motion } from 'motion/react'
import { parseRuntime } from '../../../../shared/ranking.ts'
import type { Meta, MetaPreview } from '../../../../shared/types.ts'
import { Hint } from '../../_components/hint.tsx'
import type { RailItem } from '../../data.ts'
import { credits, facts } from '../../format.ts'
import { ty } from '../../motion.ts'
import { Status } from './status.tsx'

type EntryProps = {
  item?: MetaPreview
  rail?: RailItem
  meta?: Meta
  number?: number
  dwell: boolean
  loading: boolean
  empty: boolean
  failed: boolean
  noSources: boolean
  section?: string
  hasRail: boolean
}

/** The baseline under the wall: the focused title (or Continuar tile), its facts and what each button does. */
export function Entry(p: EntryProps) {
  if (p.rail) {
    const r = p.rail
    const d = r.download
    // "Série · T1 E3 · Piloto": the series is the title, the episode leads the meta line.
    const [show, ...episode] = r.title.split(' · ')
    const label = r.upNext ? 'Próximo episódio' : (r.progress ?? d)?.label
    return (
      <footer className="entry" aria-live="polite">
        <div className="entry-main">
          <div className="entry-line">
            <h1 className="entry-title">{show}</h1>
          </div>
          <p className="entry-meta">{[episode.join(' · '), label].filter(Boolean).join(' · ')}</p>
          <p className="entry-actions">
            <Hint b="A">{r.progress ? 'Continuar' : r.upNext ? 'Assistir o próximo' : 'Assistir'}</Hint>
            <Hint b="Y">Detalhes</Hint>
            {d && d.state !== 'done' ? (
              <Hint b="X">{d.state === 'downloading' ? 'Pausar download' : 'Retomar download'}</Hint>
            ) : (
              <Hint b="X">Remover de Continuar</Hint>
            )}
            <Hint b="Down">Títulos</Hint>
          </p>
        </div>
      </footer>
    )
  }
  // One live region whatever it shows: screen readers hear the focused title as the D-pad moves.
  // Failure, nothing installed and an empty section each say so, and what to press next.
  if (p.noSources)
    return (
      <Status text="Nenhuma fonte de catálogo instalada.">
        <Hint b="Menu">Adicionar em Perfil → Addons</Hint>
      </Status>
    )
  if (p.failed)
    return (
      <Status text={`Não deu para carregar ${p.section ?? 'esta seção'}. A fonte não respondeu.`}>
        <Hint b="A">Tentar de novo</Hint>
        <Hint b={['LB', 'RB']}>Outra seção</Hint>
      </Status>
    )
  if (p.loading) return <Status text="Carregando títulos…" />
  if (p.empty)
    return (
      <Status text="Nenhum título nesta seção.">
        <Hint b={['LB', 'RB']}>Outra seção</Hint>
      </Status>
    )
  const m = p.meta ?? p.item
  if (!m) return <footer className="entry" aria-live="polite" />
  const credit = credits(p.meta ?? {}, 3)
  return (
    <footer className="entry" aria-live="polite">
      <div className="entry-main">
        <div className="entry-line">
          {p.number && <span className="entry-no">Nº {p.number}</span>}
          <h1 className="entry-title">{m.name}</h1>
        </div>
        <p className="entry-meta">{facts(m, parseRuntime(p.meta?.runtime))}</p>
        <p className="entry-actions">
          <Hint b="A">Abrir</Hint>
          {!p.dwell && <Hint b="Y">Mais</Hint>}
          {p.hasRail && <Hint b="Up">Continuar</Hint>}
        </p>
      </div>
      {/* Dwell fills the right half of the baseline zone, so it never covers a cover on the wall. */}
      <AnimatePresence>
        {p.dwell && (m.description || credit) && (
          <motion.div
            key={m.id}
            className="entry-more"
            initial={{ opacity: 0, transform: ty('0.75rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {m.description && <p className="entry-synopsis">{m.description}</p>}
            {credit && <p className="entry-credits">{credit}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  )
}
