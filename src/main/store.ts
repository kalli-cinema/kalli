import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Accent, Addon, Download, History, Profile, Settings } from '../shared/types.ts'

type State = {
  addons: Addon[]
  settings: Settings
  profiles: Profile[]
  /** Active profile id. */
  profile: string
  /** Watch history by profile id. */
  history: Record<string, History>
  /** The library is the household's: one set of downloads for every profile. */
  downloads: Record<string, Download>
  /**
   * The display cinema mode turned HDR on for (`hdrOff`: turn it back off), kept until it is put back (also after a
   * crash, at the next start).
   */
  display?: { id: string; hdrOff?: boolean }
}

const SETTINGS: Settings = {
  audioPassthrough: false,
  highQuality: true,
  smoothMotion: false,
  cinema: true,
  sound: 'original',
  ahead: true,
  uiSounds: true,
  trailers: true,
  preshow: false,
  cih: false,
  hueBridge: '',
  hueUser: '',
  hueRoom: '',
  lightsWebhook: '',
  maxRes: 2160,
  downloadDir: '',
  tmdbKey: '',
  autostart: false,
  closeToTray: false,
  onboarded: false,
  volume: 100
}

const ACCENTS: Accent[] = ['edition', 'sky', 'rose', 'emerald', 'violet', 'orange']

/** A new person gets the first accent nobody uses yet, so avatars tell people apart. */
export const newProfile = (name: string, taken: Accent[] = []): Profile => ({
  id: randomUUID().slice(0, 8),
  name,
  accent: ACCENTS.find((a) => !taken.includes(a)) ?? 'edition',
  avatar: '',
  language: 'dub',
  subtitles: false,
  subSize: 'medium',
  subColor: 'white',
  subBox: false,
  autoSkip: false,
  autoNext: true
})

const file = () => join(app.getPath('userData'), 'state.json')

// The app was called kaleidescape-de-pobre: its userData folder and its library folder were named after it.
const LEGACY = 'kaleidescape-de-pobre'

/** First start as Kalli: carry the old state over (addons with debrid keys, progress, downloads). */
function adoptLegacyState() {
  const old = join(app.getPath('appData'), LEGACY, 'state.json')
  if (existsSync(file()) || !existsSync(old)) return
  mkdirSync(dirname(file()), { recursive: true })
  copyFileSync(old, file())
}

/** Saved before profiles existed: one household-wide history and audio/subtitle language lists. */
type Legacy = Partial<History> & { settings?: { audioLangs?: string[]; subLangs?: string[]; mpvPath?: string } }

function load(): State {
  let saved: Partial<State> & Legacy = {}
  try {
    adoptLegacyState()
    saved = JSON.parse(readFileSync(file(), 'utf8'))
  } catch {
    // first start, or unreadable: start fresh
  }
  const { progress, watched, ...rest } = saved
  const { audioLangs: _a, subLangs: _s, mpvPath: _m, ...settings } = saved.settings ?? {}
  const s: State = {
    addons: [],
    profiles: [],
    profile: '',
    history: {},
    downloads: {},
    ...rest,
    settings: { ...SETTINGS, ...settings }
  }
  if (!s.profiles.length) {
    // Before profiles, the household shared one history: it becomes the first profile's, and setup is done.
    const p = newProfile('Casa')
    s.profiles = [p]
    s.history = { [p.id]: { ...emptyHistory(), progress: progress ?? {}, watched: watched ?? {} } }
    if (s.addons.length) s.settings.onboarded = true
  }
  // Profiles and histories saved before a field existed get its default.
  s.profiles = s.profiles.map((p) => ({ ...newProfile(p.name), ...p }))
  for (const id of Object.keys(s.history)) s.history[id] = { ...emptyHistory(), ...s.history[id] }
  if (!s.profiles.some((p) => p.id === s.profile)) s.profile = s.profiles[0].id
  return s
}

const emptyHistory = (): History => ({ progress: {}, watched: {}, upNext: {}, dismissed: {}, tracks: {}, rated: {} })

export const state = load()

export const activeProfile = () => state.profiles.find((p) => p.id === state.profile)!
export const history = (id = state.profile) => (state.history[id] ??= emptyHistory())

// tmp + rename: a crash mid-write never leaves a truncated state.json (installed addons hold debrid keys).
export function save() {
  const tmp = file() + '.tmp'
  writeFileSync(tmp, JSON.stringify(state, null, 2))
  renameSync(tmp, file())
}

// Downloads keep absolute paths and torrents re-open from this folder, so an existing library keeps its old name.
// ponytail: never renamed on disk; move it by hand and set Settings.downloadDir if the old name bothers anyone.
const legacyLibrary = () => join(app.getPath('videos'), LEGACY)
export const downloadDir = () =>
  state.settings.downloadDir || (existsSync(legacyLibrary()) ? legacyLibrary() : join(app.getPath('videos'), 'Kalli'))
