import type { LightRoom, Settings } from '../shared/types.ts'
import { getJson } from './http.ts'

// The room follows the film, like a cinema: lights fade down when it plays, up to a glow on pause, slowly back as
// the credits roll. Philips Hue directly (its bridge's local v1 API, paired with the link button); anything else
// (Home Assistant, Homey...) through a webhook that receives the moment as JSON.
// ponytail: the bridge's address from Philips' discovery service, saved at pairing; pair again if it changes.

export type Scene = 'play' | 'pause' | 'credits' | 'stop'

type Group = { name: string; type: string; state: { any_on: boolean }; action: { bri?: number } }

const hue = (s: Settings, path: string) => `http://${s.hueBridge}/api/${encodeURIComponent(s.hueUser)}/groups/${encodeURIComponent(s.hueRoom)}${path}`

async function put(s: Settings, body: object) {
  await fetch(hue(s, '/action'), { method: 'PUT', body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
}

/** The room as it was before the film: what it goes back to. Null when it was dark (then it stays untouched). */
let before: { bri: number } | null = null
let last: Scene = 'stop'

async function hueScene(s: Settings, scene: Scene) {
  if (scene === 'play' && !before) {
    const g = await getJson<Group>(hue(s, ''), { timeout: 5000 })
    before = g.state.any_on ? { bri: g.action.bri ?? 254 } : null
  }
  if (!before) return
  // transitiontime is in tenths of a second.
  if (scene === 'play') await put(s, { on: false, transitiontime: 30 })
  if (scene === 'pause') await put(s, { on: true, bri: Math.max(40, Math.round(before.bri * 0.35)), transitiontime: 15 })
  if (scene === 'credits') await put(s, { on: true, bri: before.bri, transitiontime: 100 })
  if (scene === 'stop') await put(s, { on: true, bri: before.bri, transitiontime: 30 })
}

// One change at a time, in order: a pause right after play must find the room's "before" already read.
let queue = Promise.resolve()

/** Moves the room to the film's moment; repeats and failures are silent (lights never get in the way of a film). */
export function scene(s: Settings, next: Scene) {
  if (next === last) return
  last = next
  if (s.hueBridge && s.hueUser && s.hueRoom)
    queue = queue
      .then(() => hueScene(s, next))
      .catch((e: Error) => console.error('hue', e.message))
      .finally(() => next === 'stop' && (before = null))
  if (/^https?:\/\//i.test(s.lightsWebhook))
    void fetch(s.lightsWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: next }),
      signal: AbortSignal.timeout(5000)
    }).catch((e: Error) => console.error('lights webhook', e.message))
}

/**
 * Finds the bridge on this network and waits up to 30 s for its link button: the user it returns is Kalli's key.
 * Throws a PT-BR message for the person.
 */
export async function pair(): Promise<{ bridge: string; user: string }> {
  const found = await getJson<{ internalipaddress: string }[]>('https://discovery.meethue.com/', { timeout: 8000 }).catch(() => [])
  const bridge = found[0]?.internalipaddress
  if (!bridge || !/^[\d.:a-f[\]]+$/i.test(bridge)) throw new Error('Nenhuma ponte Hue nesta rede. Ela precisa estar ligada e no mesmo Wi-Fi.')
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`http://${bridge}/api`, {
      method: 'POST',
      body: JSON.stringify({ devicetype: 'kalli#cinema' }),
      signal: AbortSignal.timeout(5000)
    }).catch(() => null)
    const [r] = ((await res?.json().catch(() => null)) ?? []) as { success?: { username: string } }[]
    if (r?.success?.username) return { bridge, user: r.success.username }
    await new Promise((ok) => setTimeout(ok, 1000))
  }
  throw new Error('O botão da ponte Hue não foi apertado a tempo. Aperte o botão redondo dela e pareie de novo.')
}

/** The bridge's rooms and zones, the ones a film can dim. */
export async function rooms(s: Settings): Promise<LightRoom[]> {
  if (!s.hueBridge || !s.hueUser) return []
  const groups = await getJson<Record<string, Group>>(`http://${s.hueBridge}/api/${encodeURIComponent(s.hueUser)}/groups`, { timeout: 5000 })
  return Object.entries(groups)
    .filter(([, g]) => g.type === 'Room' || g.type === 'Zone')
    .map(([id, g]) => ({ id, name: g.name }))
}
