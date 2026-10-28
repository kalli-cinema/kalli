import { useRef, useState, type PointerEvent } from 'react'
import type { Segment } from '../../../../shared/segments.ts'
import { clock } from '../../format.ts'
import { cn } from '../../lib/utils.ts'

type SeekBarProps = {
  pos: number
  dur: number
  ahead: number
  segments: Segment[]
  chapters: number[]
  focused: boolean
  onSeek: (to: number) => void
  onHover: () => void
}

/**
 * The timeline: played in the accent, buffered in faint ink, chapters as notches, openings and credits as quieter
 * stretches. The pointer previews the time under it and seeks on release; the pad scrubs with Left/Right.
 */
export function SeekBar({ pos, dur, ahead, segments, chapters, focused, onSeek, onHover }: SeekBarProps) {
  const bar = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [drag, setDrag] = useState(false)
  const at = (e: PointerEvent) => {
    const r = bar.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur
  }
  const shown = drag && hover != null ? hover : pos
  const pct = (t: number) => `${dur ? (Math.min(t, dur) / dur) * 100 : 0}%`

  return (
    <div
      ref={bar}
      className={cn('seek', (focused || drag) && 'is-focused')}
      role="slider"
      aria-label="Posição"
      aria-valuemin={0}
      aria-valuemax={Math.round(dur)}
      aria-valuenow={Math.round(pos)}
      aria-valuetext={`${clock(pos)} de ${clock(dur)}`}
      onPointerEnter={onHover}
      onPointerMove={(e) => setHover(at(e))}
      onPointerLeave={() => !drag && setHover(null)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        setDrag(true)
        setHover(at(e))
      }}
      onPointerUp={(e) => {
        if (!drag) return
        setDrag(false)
        onSeek(at(e))
      }}
    >
      <div className="seek-track">
        <span className="seek-ahead" style={{ width: pct(pos + ahead) }} />
        {segments.map((s) => (
          <span key={`${s.kind}${s.start}`} className="seek-segment" style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }} />
        ))}
        <span className="seek-played" style={{ width: pct(shown) }} />
        {chapters.map((t) => (
          <span key={t} className="seek-notch" style={{ left: pct(t) }} />
        ))}
      </div>
      <span className="seek-thumb" style={{ left: pct(shown) }} />
      {hover != null && (
        <span className="seek-preview tnum" style={{ left: pct(hover) }}>
          {clock(hover)}
        </span>
      )}
    </div>
  )
}
