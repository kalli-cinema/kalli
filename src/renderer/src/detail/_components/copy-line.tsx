import type { Ranked } from '../../../../shared/ranking.ts'
import type { Download } from '../../../../shared/types.ts'
import { copyLabel, gb, verdictText } from '../../format.ts'

type CopyLineProps = {
  ranked: Ranked[] | null
  best?: Ranked
  measuring: boolean
  dl?: Download
  slow: boolean
  failed: number
  asked: number
  queued: boolean
}

/** The cópia the machine picked and whether it plays now: a download on disk wins, then the best ranked one. */
export function CopyLine(p: CopyLineProps) {
  if (p.dl)
    return (
      <div className="copy-line">
        <p className="copy-spec">
          <span className="copy-label">Cópia</span>
          {p.dl.label}
          {p.dl.size ? <span className="tnum"> · {gb(p.dl.size)}</span> : null}
        </p>
        <p className="copy-verdict">
          {p.dl.state === 'done'
            ? 'No disco. Toca sem internet.'
            : p.dl.state === 'error'
              ? `O download parou (${p.dl.error ?? 'erro'}). Pressione X para tentar de novo.`
              : `${gb(p.dl.received)} de ${p.dl.size ? gb(p.dl.size) : '…'} no disco. Dá para assistir enquanto baixa.`}
        </p>
      </div>
    )
  const then = p.queued ? ' Começa assim que terminar.' : ''
  if (!p.ranked)
    return (
      <div className="copy-line">
        <p className="copy-verdict">
          {p.slow ? 'Ainda procurando: as fontes estão lentas para responder.' : 'Procurando cópias nas suas fontes…'}
          {then}
        </p>
      </div>
    )
  if (!p.ranked.length)
    return (
      <div className="copy-line">
        <p className="copy-verdict">
          {p.failed
            ? `${p.failed === p.asked ? 'Nenhuma fonte respondeu' : `${p.failed} de ${p.asked} fontes não responderam`}. Tente de novo com Y.`
            : p.asked
              ? 'Nenhuma cópia encontrada nas suas fontes.'
              : 'Nenhuma fonte de cópias instalada. Adicione uma em Perfil → Addons.'}
        </p>
      </div>
    )
  const b = p.best ?? p.ranked[0]
  return (
    <div className="copy-line">
      <p className="copy-spec">
        <span className="copy-label">Cópia</span>
        {copyLabel(b.info) || 'Qualidade não informada'}
        {b.info.sizeGB ? <span className="tnum"> · {gb(b.info.sizeGB * 1e9)}</span> : null}
      </p>
      <p className="copy-verdict">{p.measuring ? `Medindo sua conexão…${then}` : verdictText(b)}</p>
    </div>
  )
}
