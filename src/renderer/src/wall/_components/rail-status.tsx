import { Check, DownloadIcon, Play } from '../../_components/icons.tsx'
import type { RailItem } from '../../data.ts'
import { gb, minutesLeft, percent } from '../../format.ts'

/** The tile's second line: download state first, then the next episode, then time left, then "downloaded". */
export function RailStatus({ item: { progress: p, download: d, upNext } }: { item: RailItem }) {
  if (d?.state === 'downloading')
    return (
      <>
        <DownloadIcon className="ico" /> {percent(d) || 'Iniciando'} · {gb(d.received)}
        {d.size ? ` de ${gb(d.size)}` : ''}
      </>
    )
  if (d?.state === 'paused') return `Pausado em ${percent(d) || '0%'}`
  if (d?.state === 'error') return 'Download parou: tente de novo'
  if (upNext)
    return (
      <>
        <Play className="ico" /> Próximo episódio
      </>
    )
  if (p) return minutesLeft(p.dur - p.pos)
  if (d)
    return (
      <>
        <Check className="ico" /> Baixado · {d.label}
      </>
    )
  return null
}
