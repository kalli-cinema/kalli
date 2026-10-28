import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { MAX_VOLUME } from '../../../../shared/types.ts'
import { cn } from '../../lib/utils.ts'
import { Control } from './control.tsx'
import { useWheelStep } from '../../_hooks/use-wheel-step.ts'

type VolumeProps = {
  volume: number
  muted: boolean
  focused: boolean
  onMute: () => void
  onVolume: (v: number) => void
  onHover: () => void
}

/**
 * Mute button and a slider from 0 to 200%: the first half is the normal range, the second (in red) amplifies quiet
 * mixes. Drag or click it, scroll over it, or step it with LT/RT (PgUp/PgDn) and +/-.
 */
export function Volume({ volume, muted, focused, onMute, onVolume, onHover }: VolumeProps) {
  const track = useRef<HTMLDivElement>(null)
  const set = (e: PointerEvent) => {
    const r = track.current!.getBoundingClientRect()
    // Snaps to 100% near the mark, so going back to normal is easy with a mouse.
    const v = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * MAX_VOLUME)
    onVolume(Math.abs(v - 100) <= 4 ? 100 : v)
  }
  const onWheel = useWheelStep((dir) => onVolume(Math.max(0, Math.min(MAX_VOLUME, volume - dir * 5))))
  const level = muted ? 0 : Math.min(volume, MAX_VOLUME) / MAX_VOLUME
  const boosted = !muted && volume > 100
  const Icon = muted || volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2
  return (
    <div className="player-volume" onWheel={onWheel}>
      <Control label={muted ? 'Ativar som' : 'Sem som'} focused={focused} onClick={onMute} onHover={onHover}>
        <Icon />
      </Control>
      <div
        ref={track}
        className="volume-track"
        role="slider"
        aria-label="Volume"
        aria-valuemin={0}
        aria-valuemax={MAX_VOLUME}
        aria-valuenow={muted ? 0 : volume}
        aria-valuetext={muted ? 'Sem som' : `${volume}%${boosted ? ', amplificado' : ''}`}
        onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), set(e))}
        onPointerMove={(e) => e.buttons === 1 && set(e)}
      >
        {/* The fill is ink up to the 100% mark and red past it; its own width scales, the colour stop stays on the mark. */}
        <span
          className="volume-level"
          style={{
            transform: `scaleX(${level})`,
            background: boosted ? `linear-gradient(to right, var(--ink) ${(100 / volume) * 100}%, var(--boost) 0)` : undefined
          }}
        />
        <span className="volume-mark" aria-hidden />
        <span className={cn('volume-thumb', boosted && 'is-boosted')} style={{ left: `${level * 100}%` }} />
      </div>
      <span className={cn('volume-value tnum', boosted && 'is-boosted')}>{muted ? 'Mudo' : `${volume}%`}</span>
    </div>
  )
}
