import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, Notification as SystemNotification, Tray } from 'electron'
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import * as addons from './addons.ts'
import * as downloads from './downloads.ts'
import * as bluetooth from './bluetooth.ts'
import * as display from './display.ts'
import * as gamepad from './gamepad.ts'
import * as lights from './lights.ts'
import { hostOf } from '../shared/ranking.ts'
import { creditsStart, videoSegments, type IntroDb } from '../shared/segments.ts'
import { getJson } from './http.ts'
import * as mpv from './mpv.ts'
import * as overlay from './overlay.ts'
import * as player from './player.ts'
import { activeProfile, history, newProfile, save, state } from './store.ts'
import * as tmdb from './tmdb.ts'
import * as torrents from './torrents.ts'
import * as updater from './updater.ts'
import type {
  Action,
  After,
  Controllers,
  Download,
  DownloadRequest,
  MetaPreview,
  Notification,
  PlayerCommand,
  PlayerState,
  PlayerView,
  PlayRequest,
  Probe,
  Profile,
  Profiles,
  Rumble,
  Settings,
  SoundMode,
  TorrentRef
} from '../shared/types.ts'
import { AVATARS } from '../shared/types.ts'
import appIcon from '../../build/icon.png?asset'
import trayIcon from '../../build/tray.png?asset'

// mpv draws into Kalli's window by its X11 id and the overlay is placed over it by position: Wayland has neither, so
// Linux runs under XWayland. Electron reads the switch before this code runs (the dev scripts pass it), hence the
// restart. An AppImage restarts through its own file: its mount, app.relaunch's helper included, goes away with this
// process. This instance never takes the single-instance lock, so the new one gets it.
// ponytail: XWayland; native Wayland needs mpv rendered through libmpv into the window.
if (app.commandLine.getSwitchValue('ozone-platform') === 'wayland') {
  spawn(process.env.APPIMAGE ?? process.execPath, [...process.argv.slice(1), '--ozone-platform=x11'], { detached: true, stdio: 'inherit' }).unref()
  app.exit(0)
}

// Windows marks a window fully covered by fullscreen mpv as hidden and throttles it.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
// mpv draws into Kalli's window (--wid). With DirectComposition Chromium's surface is composited above child
// windows and hides the video; without it the child window shows. The overlay's transparency still works.
app.commandLine.appendSwitch('disable-direct-composition')

if (!app.requestSingleInstanceLock()) app.quit()

let win: BrowserWindow
let tray: Tray
let quitting = false

function createWindow() {
  const dev = process.env.ELECTRON_RENDERER_URL
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    backgroundColor: '#13110E',
    autoHideMenuBar: true,
    title: 'Kalli',
    // Windows takes the icon from the .exe; Linux needs it on the window.
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      backgroundThrottling: false,
      // Pad presses arrive over IPC, never as a user gesture: the interface sounds and the muted trailers may play anyway.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== new URL(win.webContents.getURL()).origin) e.preventDefault()
  })
  // Electron's default menu also binds F11 (View → Toggle Full Screen): without preventDefault both toggle and cancel out.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.key !== 'F11') return
    e.preventDefault()
    if (input.type === 'keyDown' && !input.isAutoRepeat) bigPicture(!win.isFullScreen())
  })
  // Closing quits. It hides to the tray instead only while downloads run (they'd stop) or when the person chose
  // "Continuar na bandeja" (Perfil → Preferências), and then says so: nothing keeps running unseen.
  win.on('close', (e) => {
    if (quitting) return
    e.preventDefault()
    const running = downloads.list().filter((d) => d.state === 'downloading').length
    if (!running && !state.settings.closeToTray) return quitApp()
    // A video never plays on in a hidden window.
    if (player.isPlaying()) player.apply({ kind: 'quit' })
    bigPicture(false, true)
    trayNotice(
      running
        ? `${running === 1 ? 'Um download continua' : `${running} downloads continuam`} na bandeja. Clique no ícone do Kalli para voltar; Sair no menu dele fecha tudo.`
        : 'O Kalli continua na bandeja, como pedido em Perfil → Preferências. Clique no ícone para voltar.'
    )
  })
  win.on('enter-full-screen', () => (win.webContents.send('bigpicture', true), pushView()))
  win.on('leave-full-screen', () => (win.webContents.send('bigpicture', false), pushView()))
  win.once('ready-to-show', () => !process.argv.includes('--hidden') && win.show())
  if (dev) win.loadURL(dev)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

/** Steam-style Big Picture: fullscreen 10-foot mode on, or back to the desktop (window or tray). */
function bigPicture(on: boolean, hide = false) {
  if (on) {
    win.show()
    win.setFullScreen(true)
    win.focus()
  } else {
    win.setFullScreen(false)
    if (hide) win.hide()
  }
}

/** A system notification from the tray icon (Windows shows it as a toast). */
function trayNotice(content: string) {
  if (process.platform === 'win32') tray.displayBalloon({ title: 'Kalli continua aberto', content, iconType: 'info', respectQuietTime: true })
  else if (SystemNotification.isSupported()) new SystemNotification({ title: 'Kalli continua aberto', body: content }).show()
}

/**
 * Quits for real. A playing video is stopped cleanly first, so its position is saved (the player's exit handler
 * then calls app.quit); a player that doesn't answer in 3 s is killed by before-quit.
 */
function quitApp() {
  if (quitting) return
  quitting = true
  if (!player.isPlaying()) return app.quit()
  player.apply({ kind: 'quit' })
  setTimeout(() => app.quit(), 3000)
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('Kalli')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir em tela cheia', click: () => bigPicture(true) },
      { label: 'Abrir em janela', click: () => (bigPicture(false), win.show()) },
      { type: 'separator' },
      { label: 'Sair', click: quitApp }
    ])
  )
  tray.on('click', () => bigPicture(true))
}

// While a video plays, the pad belongs to the player overlay.
function onAction(a: Action) {
  if (overlay.isOpen()) return overlay.sendInput(a)
  if (a === 'guide') return bigPicture(!(win.isVisible() && win.isFullScreen() && win.isFocused()))
  if (win.isVisible()) win.webContents.send('input', a)
}

const addonByUrl = (url: string) => {
  const a = state.addons.find((a) => a.transportUrl === url)
  if (!a) throw new Error('Addon not installed')
  return a
}

ipcMain.handle('addons', async () => {
  if (!state.addons.length) {
    // One that is down is skipped: Perfil → Addons can add it later.
    const got = await Promise.allSettled(addons.DEFAULTS.map(addons.fetchAddon))
    state.addons = got.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    if (state.addons.length) save()
  }
  return state.addons
})

// The manifest only, nothing installed: Perfil → Addons shows what an addon brings before it is added.
ipcMain.handle('addon:preview', (_, url: string) => addons.fetchAddon(url))

ipcMain.handle('addon:install', async (_, url: string) => {
  const a = await addons.fetchAddon(url)
  // Same id = same addon with a new configuration (e.g. a new debrid key): replace in place.
  const i = state.addons.findIndex((x) => x.manifest.id === a.manifest.id)
  if (i >= 0) state.addons[i] = a
  else state.addons.push(a)
  save()
  return state.addons
})

ipcMain.handle('addon:remove', (_, url: string) => {
  state.addons = state.addons.filter((a) => a.transportUrl !== url)
  save()
  return state.addons
})

ipcMain.handle('catalog', (_, url: string, type: string, id: string, extra?: Record<string, string>) =>
  addons.catalog(addonByUrl(url), type, id, extra)
)
ipcMain.handle('meta', async (_, type: string, id: string, full: boolean) => {
  const m = await addons.meta(state.addons, type, id)
  return m && tmdb.localize(m, state.settings.tmdbKey, full)
})
ipcMain.handle('streams', (_, type: string, id: string) => addons.streams(state.addons, type, id))

// One measure per host: a debrid CDN serves every link it gives, but each addon may run its own server.
const bandwidth = new Map<string, { mbps: number; at: number }>()
/** Addon links (debrid resolvers) and the CDN address each led to, for 10 min: play opens the CDN directly. */
const resolved = new Map<string, { to: string; at: number }>()
const resolvedOf = (url: string) => {
  const r = resolved.get(url)
  return r && Date.now() - r.at < 10 * 60_000 ? r.to : undefined
}
// Continuar's focused tile: its link is followed to the CDN ahead of the press, so A starts the film at once.
ipcMain.handle('play:warm', async (_, url: string, headers?: Record<string, string>) => {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url) || resolvedOf(url)) return
  const r = await addons.probe(url, headers, true).catch(() => ({ resolved: undefined }))
  if (r.resolved) resolved.set(url, { to: r.resolved, at: Date.now() })
})
// Every link is still checked (a known host only gets the quick check): a dead one must never be the pick.
ipcMain.handle('bandwidth', async (_, url: string, headers?: Record<string, string>): Promise<Probe> => {
  const host = hostOf(url)
  const known = bandwidth.get(host)
  const fresh = known && Date.now() - known.at < 10 * 60_000
  const r: { mbps: number; dead?: boolean; resolved?: string } = await addons.probe(String(url), headers, fresh).catch(() => ({ mbps: 0 }))
  if (r.dead) return { dead: true }
  if (r.resolved) resolved.set(String(url), { to: r.resolved, at: Date.now() })
  if (fresh) return { mbps: known.mbps }
  if (r.mbps) bandwidth.set(host, { mbps: r.mbps, at: Date.now() })
  return { mbps: r.mbps || undefined }
})

let hw: ReturnType<typeof player.hwCodecs> | null = null
ipcMain.handle('hw', () => (hw ??= player.hwCodecs()))

/** Opt-in login item: starts hidden in the tray, so nothing appears on screen until Guide is pressed. */
function applyAutostart(on: boolean) {
  const args = app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden']
  if (process.platform !== 'linux') return app.setLoginItemSettings({ openAtLogin: on, path: process.execPath, args })
  const dir = join(app.getPath('home'), '.config', 'autostart')
  const file = join(dir, 'kalli.desktop')
  // Written under the app's old name before it became Kalli; never leave both starting at login.
  rmSync(join(dir, 'kaleidescape-de-pobre.desktop'), { force: true })
  if (!on) return rmSync(file, { force: true })
  mkdirSync(dirname(file), { recursive: true })
  // An AppImage's execPath lives in a mount that is gone after a reboot; the .AppImage file itself stays.
  const exec = [process.env.APPIMAGE ?? process.execPath, ...args].map((a) => `"${a}"`).join(' ')
  writeFileSync(file, `[Desktop Entry]\nType=Application\nName=Kalli\nExec=${exec}\nX-GNOME-Autostart-enabled=true\n`)
}

/** A renderer patch only touches fields the target already has, keeping their types. */
function merge<T extends object>(target: T, patch: Partial<T>) {
  const t = target as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) if (k !== 'id' && k in t && typeof v === typeof t[k]) t[k] = v
}

// --- Controllers: the ones in use (SDL) and Bluetooth pairing without Windows Settings (Perfil → Controles). ---

const controllers = async (): Promise<Controllers> => ({
  connected: gamepad.connected(),
  paired: await bluetooth.paired().catch(() => []),
  bluetooth: bluetooth.supported
})
ipcMain.handle('controllers', controllers)
ipcMain.handle('controllers:scan', () => bluetooth.scan())
ipcMain.handle('controllers:pair', async (_, id: string) => {
  const name = await bluetooth.pair(String(id))
  notify({ kind: 'gamepad', title: 'Controle pareado', body: `${name}: daqui em diante ele conecta sozinho ao ligar` })
  return controllers()
})
// --- Lights (Perfil → Luzes): pair a Hue bridge with its link button, list its rooms. ---

ipcMain.handle('lights:pair', async () => {
  const { bridge, user } = await lights.pair()
  Object.assign(state.settings, { hueBridge: bridge, hueUser: user, hueRoom: '' })
  const found = await lights.rooms(state.settings).catch(() => [])
  // One room: nothing to choose.
  if (found.length === 1) state.settings.hueRoom = found[0].id
  save()
  return found
})
ipcMain.handle('lights:rooms', () => lights.rooms(state.settings).catch(() => []))

ipcMain.handle('trailer', (_, ytId: string, sound?: boolean) => downloads.trailerUrl(String(ytId), sound === true))

ipcMain.handle('controllers:forget', async (_, id: string) => {
  await bluetooth.forget(String(id))
  return controllers()
})

/**
 * First run with no controller at all: search for one in pairing mode for two minutes and pair the first found, so
 * holding its pair button is all it takes. A controller already paired needs nothing: Windows reconnects it when
 * it is turned on. Searching stops there, since a Bluetooth search can make wireless headphones stutter.
 */
async function autoPair() {
  if (!bluetooth.supported) return
  await new Promise((r) => setTimeout(r, 4000))
  if (gamepad.connected().length || (await bluetooth.paired().catch(() => [])).length) return
  notify({ kind: 'gamepad', title: 'Procurando controles', body: 'Segure o botão de parear (Xbox: sincronizar · PlayStation: Share + PS)' })
  for (let i = 0; i < 4 && !gamepad.connected().length; i++) {
    for (const d of await bluetooth.scan().catch(() => [])) {
      try {
        const name = await bluetooth.pair(d.id)
        return notify({ kind: 'gamepad', title: 'Controle pareado', body: `${name}: daqui em diante ele conecta sozinho ao ligar` })
      } catch (e) {
        notify({ kind: 'gamepad', title: 'Não deu para parear', body: e instanceof Error ? e.message : String(e), error: true })
      }
    }
  }
}

// Keyboard and mouse leave fullscreen from the wall (Esc, or its hint); the pad has Guide.
ipcMain.handle('bigpicture:set', (_, on: boolean) => bigPicture(!!on))

ipcMain.handle('settings', () => state.settings)
ipcMain.handle('settings:set', (_, patch: Partial<Settings>) => {
  merge(state.settings, patch)
  if ('tmdbKey' in patch) tmdb.clear()
  if ('autostart' in patch) applyAutostart(state.settings.autostart)
  save()
  return state.settings
})

const profiles = (): Profiles => ({ profiles: state.profiles, active: state.profile })
const profileName = (name: unknown) => {
  const n = typeof name === 'string' ? name.trim().slice(0, 24) : ''
  if (!n) throw new Error('Dê um nome ao perfil.')
  return n
}

ipcMain.handle('profiles', profiles)
ipcMain.handle('profile:set', (_, patch: Partial<Profile>) => {
  if (patch.avatar !== undefined && patch.avatar !== '' && !AVATARS.includes(patch.avatar)) throw new Error('Imagem desconhecida.')
  merge(activeProfile(), { ...patch, ...(patch.name !== undefined && { name: profileName(patch.name) }) })
  save()
  return profiles()
})
ipcMain.handle('profile:add', (_, name: string) => {
  const p = newProfile(profileName(name), state.profiles.map((x) => x.accent))
  state.profiles.push(p)
  state.profile = p.id
  save()
  return profiles()
})
ipcMain.handle('profile:switch', (_, id: string) => {
  if (state.profiles.some((p) => p.id === id)) state.profile = id
  save()
  return profiles()
})
ipcMain.handle('profile:remove', (_, id: string) => {
  if (state.profiles.length < 2) throw new Error('O último perfil não pode ser removido.')
  state.profiles = state.profiles.filter((p) => p.id !== id)
  delete state.history[id]
  if (state.profile === id) state.profile = state.profiles[0].id
  save()
  return profiles()
})

ipcMain.handle('history', () => history())
// The end card's 👍 / 👎 (0 takes the rating back).
ipcMain.handle('history:rate', (_, metaId: string, value: number) => {
  const h = history()
  if (value === 1 || value === -1) h.rated[String(metaId)] = value
  else delete h.rated[String(metaId)]
  save()
  return h
})

// The end card: the next film of the collection and films like this one (TMDB key needed). Watched or disliked
// titles never come back, and a disliked film's recommendations aren't offered.
ipcMain.handle('after', async (_, metaId: string): Promise<After> => {
  const key = state.settings.tmdbKey
  const h = history()
  const id = String(metaId)
  if (!key || !/^tt\d+$/.test(id)) return { recs: [] }
  const found = await tmdb.after(id, key, 8).catch(() => ({ next: undefined, recs: [] as string[] }))
  const fresh = (x?: string): x is string => !!x && x !== id && !h.watched[x] && h.rated[x] !== -1
  const load = async (x: string) => {
    const m = await addons.meta(state.addons, 'movie', x).catch(() => null)
    return m && (await tmdb.localize(m, key, false))
  }
  const recs = h.rated[id] === -1 ? [] : found.recs.filter((x) => fresh(x) && x !== found.next).slice(0, 3)
  const [next, ...more] = await Promise.all([fresh(found.next) ? load(found.next) : null, ...recs.map(load)])
  return { next: next ?? undefined, recs: more.filter((m) => !!m) }
})

// Skippable stretches from TheIntroDB (community timestamps, no key) for files that name no chapters. A key is
// `tt123` (film) or `tt123:1:2` (episode); null for anything else, for an unknown video or on any failure. Kept by
// key so the lights and the watched mark read the same credits as the overlay.
const introDb = new Map<string, IntroDb | null>()
ipcMain.handle('skips', async (_, key: string): Promise<IntroDb | null> => {
  const k = String(key)
  if (introDb.has(k)) return introDb.get(k)!
  const [id, season, episode] = k.split(':')
  if (!/^tt\d+$/.test(id) || (season != null && !(/^\d+$/.test(season) && /^\d+$/.test(episode ?? '')))) return null
  const q = new URLSearchParams({ imdb_id: id, ...(season != null && { season, episode }) })
  const db = await getJson<IntroDb>(`https://api.theintrodb.org/v2/media?${q}`, { timeout: 8000 }).catch(() => null)
  introDb.set(k, db)
  return db
})

ipcMain.handle('pad:rumble',(_, kind: Rumble) => kind === 'play' && gamepad.rumble(kind))
// "Remover de Continuar": the title stays out until something newer happens to it.
ipcMain.handle('history:forget', (_, metaId: string) => {
  const h = history()
  h.dismissed[String(metaId)] = Date.now()
  delete h.upNext[String(metaId)]
  save()
  return h
})

ipcMain.handle('player', () => mpv.playerStatus())
// Retry after a failed first-run install (Perfil → Preferências).
ipcMain.handle('player:install', async () => void (await mpv.ensure()))
ipcMain.handle('update', () => updater.current())
// Offered in Perfil, so no video is playing; the window must close without hiding to the tray.
ipcMain.handle('update:install', () => {
  if (player.isPlaying()) throw new Error('Feche o vídeo antes de atualizar.')
  quitting = true
  updater.install()
})

// B on the title card cancels: a play still resolving (a torrent can take a while) must not open mpv later.
let playSeq = 0
ipcMain.handle('play:cancel', () => {
  playSeq++
  player.stop()
})

ipcMain.handle('play', (_, req: PlayRequest) => startPlay(req))

/** A notification for whoever is looking: the app, and the player overlay when a video plays. */
function notify(n: Notification) {
  if (!win.isDestroyed()) win.webContents.send('notify', n)
  overlay.sendNotify(n)
}

// --- Cinema mode: decided once per session (a film, or episodes in a row, until the player closes). The first video
// opens paused; the screen moves into HDR for an HDR film (Windows), and stays that way only if the person says yes. ---

/** new: not decided; asking: switched, waiting for a yes; on: kept (or nothing needed switching); off: left alone. */
let cinema: 'new' | 'asking' | 'on' | 'off' = 'new'
let cinemaAsk: PlayerView['cinema']
let cinemaTimer: ReturnType<typeof setTimeout> | undefined
/** The screen under Kalli's window, asked for when play is pressed so the answer is ready with the first frame. */
let screenAsk: Promise<display.Screen | undefined> | undefined
/** Bumped when a session ends, so a decision still under way for it stops there. */
let session = 0
const ASK_MS = 15_000

type Replaced = NonNullable<typeof state.display>
const putBack = async (d: Replaced) => {
  if (d.hdrOff) await display.setHdr(d.id, false)
}

/** Puts back the HDR state cinema mode replaced; forgotten only once that worked (or retried at the next start). */
async function restoreDisplay() {
  const d = state.display
  if (!d) return
  await putBack(d).catch((e: Error) => console.error('display restore', e.message))
  if (state.display !== d) return
  delete state.display
  save()
}

async function cinemaOpen(film: { hdr: boolean }) {
  const s = session
  const release = () => s === session && player.apply({ kind: 'pause', on: false })
  try {
    const scr = await (screenAsk ?? display.screenOf(windowId()))
    if (s !== session) return
    if (!scr || !film.hdr || scr.hdr !== false) {
      cinema = 'off'
      return void release()
    }
    const back: Replaced = { id: scr.id, hdrOff: true }
    state.display = back
    save()
    await display.setHdr(scr.id, true)
    if (s !== session) return void putBack(back).catch(() => {})
    player.displayChanged()
    cinema = 'asking'
    cinemaAsk = { until: Date.now() + ASK_MS }
    cinemaTimer = setTimeout(() => cinemaAnswer(false), ASK_MS)
    pushView()
  } catch (e) {
    console.error('cinema', (e as Error).message)
    if (s !== session) return
    cinema = 'off'
    void restoreDisplay()
    release()
  }
}

/** A keeps the screen for the rest of the session; B, or silence for 15 s (a screen that went dark), goes back. */
function cinemaAnswer(keep: boolean) {
  if (cinema !== 'asking') return
  clearTimeout(cinemaTimer)
  cinemaAsk = undefined
  cinema = keep ? 'on' : 'off'
  if (!keep) void restoreDisplay().then(() => player.displayChanged())
  player.apply({ kind: 'pause', on: false })
  pushView()
}

/** The session is over: no question left open, the screen back as it was. */
function endCinema() {
  session++
  clearTimeout(cinemaTimer)
  cinema = 'new'
  cinemaAsk = undefined
  screenAsk = undefined
  return restoreDisplay()
}

// --- What else follows the picture: the room's lights, and downloads ahead stepping aside for the video. ---

const inCredits = (v: PlayerView) => v.dur > 0 && v.pos >= creditsStart(videoSegments(v.chapters, v.dur, introDb.get(v.req.key)), v.dur)

/** Dark while it plays, a glow on pause, back up with the credits. */
function lightsFor(v: PlayerView) {
  if (!v.started) return
  lights.scene(state.settings, v.paused ? 'pause' : inCredits(v) ? 'credits' : 'play')
}

// The pad in the hands feels each video's two moments once: the picture starting, the credits rolling.
let felt = { key: '', start: false, credits: false }
function rumbleFor(v: PlayerView) {
  if (felt.key !== v.req.key) felt = { key: v.req.key, start: false, credits: false }
  if (!felt.start && v.started && !v.paused) {
    felt.start = true
    gamepad.rumble('start')
  }
  if (!felt.credits && v.started && inCredits(v)) {
    felt.credits = true
    gamepad.rumble('credits')
  }
}

// Downloads ahead pause while the video's buffer is short and resume once it is comfortably ahead again.
function gateAhead(v: PlayerView) {
  if (v.buffering || v.ahead < 30) downloads.holdAhead(true)
  else if (v.ahead > 90) downloads.holdAhead(false)
}

/** Ends playback on screen: overlay gone, window back the way it was, the app told why. */
function endPlayback(st: PlayerState) {
  void endCinema()
  updater.hold(false)
  lights.scene(state.settings, 'stop')
  downloads.holdAhead(false)
  overlay.close()
  if (restoreWindowed) bigPicture(false)
  restoreWindowed = false
  win.webContents.send('player:exit', st)
  // A title picked on the end card: its page opens once the film is gone.
  if (opening) win.webContents.send('open', opening)
  opening = undefined
  // Closed to the tray mid-video: stay hidden.
  if (win.isVisible()) win.focus()
}

async function startPlay(req: PlayRequest) {
  const seq = ++playSeq
  // The film owns the connection: Kalli's own update download steps aside.
  updater.hold(true)
  // Progress belongs to whoever pressed play, even if the profile changes before mpv exits.
  const h = history()
  const saved = h.progress[req.key]
  // Resuming steps back into the scene: 10 s after a break, 30 s when a day or more has gone by.
  const back = saved && Date.now() - saved.at > 86_400_000 ? 30 : 10
  const start = saved && saved.pos > 30 && saved.pos < saved.dur * 0.95 ? Math.max(0, saved.pos - back) : 0
  // Online subtitles load while the link resolves; mpv adds them once the file is open.
  const subs = addons.subtitles(state.addons, req.type, req.key)
  // First run without a player: this waits for it (the title card shows the progress).
  const bin = await mpv.ensure()
  if (seq !== playSeq) return
  // Finished download: straight from disk. Downloading: through the local server (or WebTorrent's).
  // P2P without a download: a throwaway stream, deleted when playback ends.
  const dl = state.downloads[req.key]
  let url = req.url
  let local = true
  let streamed: TorrentRef | undefined
  if (dl?.state === 'done' && dl.file) url = dl.file
  else if (dl && (dl.size || dl.torrent)) url = await downloads.playUrl(dl)
  else if (req.torrent) url = await torrents.stream((streamed = req.torrent))
  else {
    // A link checked minutes ago already led to its CDN: mpv skips the resolver's round trip (often seconds).
    url = resolvedOf(req.url) ?? req.url
    local = false
  }
  if (seq !== playSeq) {
    if (streamed) void torrents.release(streamed)
    return
  }
  // A video takes the whole screen; the window goes back the way it was when the last one ends.
  if (!player.isPlaying() && !win.isFullScreen()) {
    restoreWindowed = true
    bigPicture(true)
  }
  delete h.upNext[req.metaId]
  const hold = state.settings.cinema && cinema === 'new'
  // The screen query takes a moment (PowerShell on Windows): it runs while mpv opens the file.
  if (hold) screenAsk ??= display.screenOf(windowId()).catch(() => undefined)
  const opts = {
    bin,
    settings: state.settings,
    profile: activeProfile(),
    start,
    subs,
    wid: windowId(),
    tracks: h.tracks[req.metaId] ?? {},
    hold: hold ? cinemaOpen : undefined
  }
  const playing = { ...req, url, headers: local ? undefined : req.headers }
  overlay.open(win, () => player.apply({ kind: 'quit' }))
  player.play(
    playing,
    opts,
    (st) => {
      if (streamed) void torrents.release(streamed)
      state.settings.volume = st.volume
      // Fallbacks are links of this moment: never saved with the progress.
      const { fallbacks, ...keep } = req
      if (st.dur && st.pos > 30) {
        // Watched once the credits roll (the credits chapter, or the last stretch of the video).
        if (st.pos > st.dur * 0.95 || st.pos >= creditsStart(videoSegments(st.chapters, st.dur, introDb.get(req.key)), st.dur)) {
          delete h.progress[req.key]
          h.watched[req.key] = Date.now()
          if (req.next) h.upNext[req.metaId] = { ...req.next, metaId: req.metaId, type: req.type, poster: req.poster, at: Date.now() }
          // Fetched ahead only to be watched: once it has been, the disk gets the space back.
          if (state.downloads[req.key]?.ahead) void downloads.remove(req.key)
        } else h.progress[req.key] = { ...keep, pos: st.pos, dur: st.dur, at: Date.now() }
      }
      save()
      // The next episode already took over: the overlay and the window stay as they are.
      if (player.isPlaying()) return
      // Closed while playing: the position is saved above, now the app can go (the screen back first).
      if (quitting) return void endCinema().finally(() => app.quit())
      // This cópia wouldn't open (mpv's "código 2"): the next best one starts in its place, with a word on screen.
      if (st.error && fallbacks?.length) {
        notify({ kind: 'player', title: 'Essa cópia não abriu', body: `Tentando outra: ${fallbacks[0].label || 'próxima da lista'}` })
        return void startPlay({ ...fallbacks[0], fallbacks: fallbacks.slice(1) }).catch((e: Error) => endPlayback({ ...st, error: e.message }))
      }
      endPlayback(st)
    },
    sendView
  )
}

/** Kalli's window for mpv's --wid: an HWND on Windows, an X11 window id on Linux. */
// ponytail: X11/XWayland only on Linux; native Wayland can't embed and would need mpv's own window back.
const windowId = () => {
  const h = win.getNativeWindowHandle()
  return (h.length >= 8 ? h.readBigUInt64LE() : BigInt(h.readUInt32LE())).toString()
}

let restoreWindowed = false

const sendView = (v: PlayerView) => {
  lightsFor(v)
  rumbleFor(v)
  gateAhead(v)
  overlay.sendView({ ...v, fullscreen: win.isFullScreen(), cinema: cinemaAsk })
}
const pushView = () => {
  const v = player.current()
  if (v) sendView(v)
}

const COMMANDS = new Set<PlayerCommand['kind']>(['pause', 'seek', 'skip', 'volume', 'mute', 'audio', 'sub', 'fullscreen', 'quit', 'cinema', 'sound', 'open'])
const SOUNDS = new Set<SoundMode>(['original', 'dialogue', 'night'])

/** The title the end card asked to open after the film. */
let opening: MetaPreview | undefined
const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 2048) : undefined)

// The overlay's only way to mpv: a fixed set of playback commands, each mapped in player.apply.
ipcMain.handle('player:do', (_, c: PlayerCommand) => {
  if (!c || typeof c !== 'object' || !COMMANDS.has(c.kind)) return
  if (c.kind === 'cinema') return cinemaAnswer(c.keep === true)
  if (c.kind === 'open') {
    const m: Partial<MetaPreview> = c.meta ?? {}
    const id = str(m.id)
    const type = str(m.type)
    if (!id || !type) return
    opening = { id, type, name: str(m.name) ?? '', poster: str(m.poster), background: str(m.background) }
    return void player.apply({ kind: 'quit' })
  }
  if (c.kind === 'sound') {
    if (!SOUNDS.has(c.mode) || state.settings.audioPassthrough) return
    state.settings.sound = c.mode
    save()
    player.setSound(c.mode)
    return pushView()
  }
  if (c.kind === 'fullscreen') {
    bigPicture(!win.isFullScreen())
    return overlay.focus()
  }
  const choice = player.apply(c)
  const v = player.current()
  if (choice && v) {
    // A track picked by hand opens the next episodes of the same title too.
    const h = history()
    h.tracks[v.req.metaId] = { ...h.tracks[v.req.metaId], ...choice }
    save()
  }
})
ipcMain.handle('player:view', () => {
  const v = player.current()
  return v && { ...v, fullscreen: win.isFullScreen(), cinema: cinemaAsk }
})

ipcMain.handle('downloads', () => downloads.list())
ipcMain.handle('download:add', (_, req: DownloadRequest) => downloads.add(req))
ipcMain.handle('download:pause', (_, key: string) => downloads.pause(key))
ipcMain.handle('download:resume', (_, key: string) => downloads.resume(key))
ipcMain.handle('download:remove', async (_, key: string) => {
  if (player.current()?.req.key === key) throw new Error('Pare o vídeo antes de apagar o download dele.')
  await downloads.remove(String(key))
  return downloads.list()
})

// Downloads say when they start, finish or stop on an error; a pause was asked for, so it says nothing.
const lastState = new Map<string, Download['state']>()
function onDownload(d: Download) {
  win.webContents.send('download', d)
  // A download ahead happens quietly, mid-film: no word about it on screen.
  if (d.ahead) return
  const was = lastState.get(d.key)
  lastState.set(d.key, d.state)
  if (was === d.state) return
  const name = d.title
  if (d.state === 'done' && was) notify({ kind: 'download', title: 'Download concluído', body: name })
  if (d.state === 'error') notify({ kind: 'download', title: 'O download parou', body: `${name}: ${d.error ?? 'erro'}`, error: true })
  if (d.state === 'downloading' && !was && !d.received) notify({ kind: 'download', title: 'Baixando', body: name })
}
// "Colar" on the on-screen keyboard: a manifest URL copied in a browser, pasted with the pad.
ipcMain.handle('clipboard:read', async () => (await clipboard.readText()).trim().slice(0, 2048))

app.on('second-instance', () => bigPicture(true))
app.on('before-quit', () => {
  quitting = true
  player.stop()
  save()
})

app.whenReady().then(() => {
  createWindow()
  createTray()
  // Kalli quit or crashed mid-session in cinema mode: HDR goes back to how it was.
  void restoreDisplay()
  downloads.startServer()
  downloads.resumeAll(onDownload)
  // Fetch the player now (first run), so it is ready by the first play.
  mpv.watch((s) => win.webContents.send('player:status', s))
  void mpv.ensure().catch(() => {})
  void gamepad.startGamepad(onAction, notify).then(autoPair)
  updater.start(() => player.isPlaying(), notify)
})
