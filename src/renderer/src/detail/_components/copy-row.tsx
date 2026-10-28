import type { Ranked } from '../../../../shared/ranking.ts'
import { copyLabel, gb, VERDICT_TAG } from '../../format.ts'

/** One cópia in the list: what it is, its size, bitrate and source, and its verdict tag. */
export function CopyRow({ c, focused, onHover, onClick }: { c: Ranked; focused: boolean; onHover: () => void; onClick: () => void }) {
  return (
    <li className={`copy-row ${focused ? 'is-focused' : ''} is-${c.verdict}`} onMouseEnter={onHover} onMouseMove={focused ? undefined : onHover} onClick={onClick}>
      <span className="copy-row-spec">{copyLabel(c.info) || c.stream.name?.split('\n')[0] || 'Sem detalhes'}</span>
      <span className="copy-row-facts tnum">
        {[c.info.sizeGB && gb(c.info.sizeGB * 1e9), c.bitrateMbps && `${Math.round(c.bitrateMbps)} Mbps`, c.stream.addon].filter(Boolean).join(' · ')}
      </span>
      <span className="copy-row-tag">{VERDICT_TAG[c.verdict]}</span>
    </li>
  )
}
