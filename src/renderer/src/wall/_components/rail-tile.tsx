import { sized, type RailItem } from '../../data.ts'
import { RailStatus } from './rail-status.tsx'

/** A Continuar tile: backdrop, progress (or download) meter, title and status. A next episode has no meter. */
export function RailTile({ item, focused, onClick, onHover }: { item: RailItem; focused: boolean; onClick: () => void; onHover: () => void }) {
  const p = item.progress
  const d = item.download
  const pct = d && d.state !== 'done' && d.size ? d.received / d.size : p ? p.pos / p.dur : 0
  // "Série · T1 E3 · Piloto": the series name on top, the episode as the status's lead.
  const [show, ...rest] = item.title.split(' · ')
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`rail-tile ${focused ? 'is-focused' : ''}`}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseMove={focused ? undefined : onHover}
      aria-current={focused || undefined}
    >
      <div className="rail-art">
        {item.background ? (
          <img src={sized(item.background, 'medium')} alt="" decoding="async" />
        ) : (
          <div className="cover-typeset" aria-hidden>
            <span>{show}</span>
          </div>
        )}
        {rest[0] && <span className="rail-episode">{rest[0]}</span>}
      </div>
      {/* Always laid out, so tiles with and without a meter keep their titles on one line. */}
      <div className={`rail-meter ${pct > 0 ? '' : 'is-empty'}`} aria-hidden>
        <span style={{ transform: `scaleX(${pct})` }} className={d && d.state !== 'done' ? 'is-download' : ''} />
      </div>
      <div className="rail-text">
        <span className="rail-title">{show}</span>
        <span className="rail-status">
          <RailStatus item={item} />
        </span>
      </div>
    </button>
  )
}
