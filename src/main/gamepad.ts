import type { Action, Notification, Rumble } from '../shared/types.ts'

const BUTTONS: Record<string, Action> = {
  dpadUp: 'up',
  dpadDown: 'down',
  dpadLeft: 'left',
  dpadRight: 'right',
  a: 'a',
  b: 'b',
  x: 'x',
  y: 'y',
  leftShoulder: 'lb',
  rightShoulder: 'rb',
  start: 'start',
  back: 'back',
  guide: 'guide'
}
const DPAD: Record<string, string> = { up: 'dpadUp', down: 'dpadDown', left: 'dpadLeft', right: 'dpadRight' }

type Power = 'empty' | 'low' | 'medium' | 'full' | 'wired' | 'max' | null

type Pad = {
  buttons: Record<string, boolean>
  axes: Record<string, number>
  power: Power
  rumble(low: number, high: number, ms: number): void
  on(ev: 'buttonDown' | 'axisMotion', fn: (e: { button?: string; axis?: string; value?: number }) => void): void
  on(ev: 'powerUpdate', fn: (e: { power: Power }) => void): void
  on(ev: 'close', fn: () => void): void
}

const BATTERY: Partial<Record<NonNullable<Power>, string>> = { low: 'Bateria fraca', empty: 'Bateria acabando' }

// The controllers in use right now, for Perfil → Controles.
const pads = new Map<Pad, { name: string; battery: Power }>()
export const connected = () => [...pads.values()].map((p) => ({ ...p }))

// The hands feel the film's moments: a thump under Play, a double pulse as the picture starts, a soft buzz with
// the credits. Each step: low motor, high motor, ms, then a pause before the next.
const FEEL: Record<Rumble | 'start' | 'credits', [number, number, number, number][]> = {
  play: [[0.55, 0.2, 110, 0]],
  start: [[0.3, 0.12, 70, 130], [0.3, 0.12, 70, 0]],
  credits: [[0.18, 0.05, 420, 0]]
}

/** Last press on a pad: a pad left on the table while the keyboard drives stays still. */
let lastPress = 0

export function rumble(kind: keyof typeof FEEL) {
  if (Date.now() - lastPress > 10 * 60_000) return
  let at = 0
  for (const [low, high, ms, gap] of FEEL[kind]) {
    setTimeout(() => {
      for (const pad of pads.keys())
        try {
          pad.rumble(low, high, ms)
        } catch {
          // a controller without motors
        }
    }, at)
    at += ms + gap
  }
}

const stickDir = (x: number, y: number, threshold: number): Action | null =>
  Math.max(Math.abs(x), Math.abs(y)) < threshold ? null : Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'

/**
 * Reads every controller through SDL in the main process, so input keeps working while the
 * window is hidden (Guide wakes Big Picture) and while mpv owns the screen.
 */
export async function startGamepad(act: (a: Action) => void, notify: (n: Notification) => void) {
  const onAction = (a: Action) => ((lastPress = Date.now()), act(a))
  // No SDL window exists, but make sure SDL never drops events for "unfocused" apps.
  process.env.SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS = '1'
  let sdl: { controller: { devices: unknown[]; openDevice(d: unknown): Pad; on(ev: 'deviceAdd', fn: (e: { device: unknown }) => void): void } }
  try {
    const m = (await import('@kmamal/sdl')) as { default?: unknown }
    sdl = (m.default ?? m) as never
  } catch (e) {
    console.warn('gamepad disabled:', e)
    return
  }

  const open = (device: unknown, announce: boolean) => {
    let pad: Pad
    try {
      pad = sdl.controller.openDevice(device)
    } catch {
      return
    }
    // Connected, gone, and the battery once it runs low (each level said once per pairing).
    const name = (device as { name?: string }).name || 'Controle'
    if (announce) notify({ kind: 'gamepad', title: 'Controle conectado', body: name })
    let warned: Power = null
    const battery = (power: Power) => {
      const text = power && BATTERY[power]
      if (!text || warned === power) return
      warned = power
      notify({ kind: 'battery', title: text, body: `${name}: carregue logo`, error: power === 'empty' })
    }
    pads.set(pad, { name, battery: pad.power })
    battery(pad.power)
    pad.on('powerUpdate', ({ power }) => (pads.set(pad, { name, battery: power }), battery(power)))
    pad.on('close', () => (pads.delete(pad), notify({ kind: 'gamepad', title: 'Controle desconectado', body: name })))
    // Held directions repeat: 320 ms delay, then every 70 ms, like a TV remote.
    let timer: NodeJS.Timeout | undefined
    const hold = (dir: Action, still: () => boolean) => {
      clearTimeout(timer)
      onAction(dir)
      const tick = (delay: number) => {
        timer = setTimeout(() => {
          if (!still()) return
          onAction(dir)
          tick(70)
        }, delay)
      }
      tick(320)
    }

    let stick: Action | null = null
    const trig = { leftTrigger: false, rightTrigger: false }

    pad.on('buttonDown', ({ button }) => {
      const a = button && BUTTONS[button]
      if (!a) return
      if (a in DPAD) hold(a, () => pad.buttons[DPAD[a]])
      else onAction(a)
    })
    pad.on('axisMotion', ({ axis, value = 0 }) => {
      if (axis === 'leftTrigger' || axis === 'rightTrigger') {
        const down = value > 0.6
        if (down && !trig[axis]) onAction(axis === 'leftTrigger' ? 'lt' : 'rt')
        trig[axis] = value > 0.3 && (trig[axis] || down)
        return
      }
      if (axis !== 'leftStickX' && axis !== 'leftStickY') return
      // Hysteresis: engage past 0.55, release under 0.35, so a resting stick never jitters focus.
      const { leftStickX: x, leftStickY: y } = pad.axes
      const dir = stickDir(x, y, stick ? 0.35 : 0.55)
      if (dir === stick) return
      stick = dir
      if (dir) hold(dir, () => stickDir(pad.axes.leftStickX, pad.axes.leftStickY, 0.35) === dir)
    })
  }

  // Pads already plugged in at start are expected: only ones that arrive later are announced.
  sdl.controller.devices.forEach((d) => open(d, false))
  sdl.controller.on('deviceAdd', ({ device }) => open(device, true))
}
