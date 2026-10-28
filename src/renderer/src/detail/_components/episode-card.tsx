import type { Download, Progress, Video } from '../../../../shared/types.ts'
import { Check } from '../../_components/icons.tsx'

type EpisodeCardProps = {
  v: Video
  focused: boolean
  progress?: Progress
  watched: boolean
  download?: Download
  onPick: () => void
  onHover: () => void
}

/** One episode on the track: still, watched check, progress (or download) meter, number and title. */
export function EpisodeCard({ v, focused, progress, watched, download: d, onPick, onHover }: EpisodeCardProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`episode ${focused ? 'is-focused' : ''} ${watched ? 'is-watched' : ''}`}
      onClick={onPick}
      onMouseEnter={onHover}
      onMouseMove={focused ? undefined : onHover}
      aria-current={focused || undefined}
    >
      <div className="episode-art">
        {v.thumbnail ? <img src={v.thumbnail} alt="" loading="lazy" decoding="async" /> : <div className="cover-typeset"><span>E{v.episode}</span></div>}
        {watched && <Check className="episode-check" />}
      </div>
      <div className="rail-meter" aria-hidden>
        <span style={{ transform: `scaleX(${progress ? progress.pos / progress.dur : d?.size ? d.received / d.size : 0})` }} className={d && !progress ? 'is-download' : ''} />
      </div>
      <span className="episode-title">
        <span className="tnum">E{v.episode}</span> {v.title ?? v.name}
      </span>
    </button>
  )
}
