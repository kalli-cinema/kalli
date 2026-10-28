import type { Action } from '../../shared/types.ts'

// Interface sounds, synthesized: nothing to ship, and each one shaped to sit low and soft under a living room, the
// way a console's menu feels physical. Silent in the player overlay: a film owns the speakers.

export type Cue = 'move' | 'select' | 'back' | 'play'

let ctx: AudioContext | null = null
let on = true
let lastMove = 0
const player = location.hash === '#player'

export const setSounds = (enabled: boolean) => void (on = enabled)

/** A short pitched tap: quick attack, exponential decay, a gentle low-pass taking the edge off. */
function tap(freq: number, { dur = 0.06, gain = 0.05, type = 'sine' as OscillatorType, to }: { dur?: number; gain?: number; type?: OscillatorType; to?: number }) {
  const a = (ctx ??= new AudioContext())
  const t = a.currentTime
  const osc = a.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  const env = a.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const soft = a.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 3200
  osc.connect(env).connect(soft).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.03)
}

/** The house lights going down: a warm open chord swelling in and fading slowly. */
function curtain() {
  const a = (ctx ??= new AudioContext())
  const t = a.currentTime
  const warm = a.createBiquadFilter()
  warm.type = 'lowpass'
  warm.frequency.setValueAtTime(500, t)
  warm.frequency.exponentialRampToValueAtTime(1400, t + 0.6)
  warm.connect(a.destination)
  for (const [freq, gain] of [[110, 0.05], [164.8, 0.035], [220, 0.03], [329.6, 0.018]]) {
    const osc = a.createOscillator()
    osc.frequency.value = freq
    const env = a.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(gain, t + 0.45)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    osc.connect(env).connect(warm)
    osc.start(t)
    osc.stop(t + 2.5)
  }
}

export function cue(c: Cue) {
  if (!on || player) return
  try {
    if (c === 'move') {
      // A held direction repeats fast: one tick per step, but never a buzz.
      const now = performance.now()
      if (now - lastMove < 40) return
      lastMove = now
      tap(1650, { dur: 0.035, gain: 0.02, type: 'triangle' })
    }
    if (c === 'select') {
      tap(520, { dur: 0.09, gain: 0.045 })
      tap(1040, { dur: 0.06, gain: 0.015 })
    }
    if (c === 'back') tap(640, { dur: 0.08, gain: 0.035, to: 430 })
    if (c === 'play') curtain()
  } catch {
    // no audio device: the interface stays silent
  }
}

const CUE: Partial<Record<Action, Cue>> = {
  up: 'move',
  down: 'move',
  left: 'move',
  right: 'move',
  lb: 'move',
  rb: 'move',
  a: 'select',
  x: 'select',
  y: 'select',
  start: 'select',
  b: 'back'
}

/** The sound a press makes. */
export const cueFor = (a: Action) => CUE[a] && cue(CUE[a])
