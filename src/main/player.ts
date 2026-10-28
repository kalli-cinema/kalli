import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { connect, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { bestAudio, type Codec } from '../shared/ranking.ts'
import { MAX_VOLUME } from '../shared/types.ts'
import type {
  Language,
  PlayerCommand,
  PlayerState,
  PlayerView,
  PlayRequest,
  Profile,
  Settings,
  SoundMode,
  Subtitle,
  Track,
  TrackChoice
} from '../shared/types.ts'

// One endpoint per mpv: a next episode spawns while the old mpv still holds (or, on exit, unlinks) its own.
let spawns = 0
const ipcPath = (n: number) =>
  process.platform === 'win32' ? `\\\\.\\pipe\\kalli-mpv-${process.pid}-${n}` : join(tmpdir(), `kalli-mpv-${process.pid}-${n}.sock`)

// mpv can't ask for "anything but Portuguese", so the original track is the first common original language.
// ponytail: a guess; TMDB's original_language would name the track exactly. A hand-picked track per series fixes it.
const ORIGINAL = ['eng', 'en', 'jpn', 'ja', 'kor', 'ko', 'spa', 'es', 'fre', 'fr', 'ger', 'de', 'ita', 'it']
const PT = ['pob', 'por', 'pt']
const EN = ['eng', 'en']

/** Subtitle languages each preset wants, most wanted first (also the online subtitles worth adding). */
const SUBS: Record<Language, string[]> = { dub: PT, 'original-pt': PT, 'original-en': EN, original: [] }

/** Audio languages each preset wants; subtitles only when the audio isn't the wanted one (`dub` without a dub). */
const AUDIO: Record<Language, string[]> = { dub: PT, 'original-pt': ORIGINAL, 'original-en': ORIGINAL, original: ORIGINAL }

const SUB_SIZE = { small: 36, medium: 46, large: 58 }
const SUB_COLOR = { white: '#FFFFFF', yellow: '#FFE45C' }

/** Subtitles start off unless the title's own pick or the profile turns them on. */
const subsOff = (p: Profile, choice: TrackChoice) => choice.sub === 'no' || (!choice.sub && (!p.subtitles || p.language === 'original'))

function languageArgs(p: Profile, choice: TrackChoice): string[] {
  const lang = p.language
  const alang = [...new Set([choice.audio, ...AUDIO[lang]].filter(Boolean))].join(',')
  const args = [`--alang=${alang}`]
  if (choice.sub === 'no') return [...args, '--sid=no']
  // Forced subtitles (signs, foreign lines) still show with subtitles off.
  if (subsOff(p, choice)) return [...args, '--slang=', '--subs-fallback=no']
  const slang = [...new Set([choice.sub, ...SUBS[lang]].filter(Boolean))].join(',')
  return [...args, `--slang=${slang}`, '--subs-with-matching-audio=no']
}

export type PlayOptions = {
  bin: string
  settings: Settings
  profile: Profile
  start: number
  subs: Promise<Subtitle[]>
  /** The window mpv draws into (Kalli's own), so the overlay can sit on top and windowed mode just works. */
  wid: string
  tracks: TrackChoice
  /** Starts paused and reports whether the film is HDR once its first frame is decoded (cinema mode deciding); main unpauses. */
  hold?: (film: { hdr: boolean }) => void
}

/** Windows HDR just changed under mpv: setting the hint again makes it read the display's colour space anew. */
export function displayChanged() {
  send('set_property', 'target-colorspace-hint', 'no')
  send('set_property', 'target-colorspace-hint', 'auto')
}

// The downmix levels lift the centre channel (where dialogue lives) when 5.1/7.1 plays on fewer speakers;
// a compressor brings loud effects closer to the voices: gently for dialogue, hard (plus a limiter) for night.
const SOUND: Record<SoundMode, { af: string; mix: string }> = {
  original: { af: '', mix: '' },
  dialogue: { af: 'lavfi=[acompressor=threshold=0.125:ratio=2.5:attack=20:release=250:makeup=1.6]', mix: 'clev=1.414,slev=0.5' },
  night: { af: 'lavfi=[acompressor=threshold=0.05:ratio=8:attack=5:release=300:makeup=3,alimiter=limit=0.9]', mix: 'clev=1.414,slev=0.5' }
}
const sound = (mode: SoundMode) => SOUND[mode] ?? SOUND.original

// A 16:9 panel zoomed onto a 2.39:1 screen shows only its middle band: the video keeps inside it.
// ponytail: zoom method on a 16:9 panel; an anamorphic lens would need the picture stretched instead.
const CIH_MARGIN = ((1 - 16 / 9 / 2.39) / 2).toFixed(4)

// Sound fades in as the picture appears and out before a quit, like a projector's shutter.
const FADE_IN_MS = 1500
const FADE_OUT_MS = 450

/** A sound mode picked in the player, applied at once. Bitstreamed audio never passes through filters. */
export function setSound(mode: SoundMode) {
  if (view) view.sound = mode
  send('set_property', 'audio-swresample-o', sound(mode).mix)
  send('set_property', 'af', sound(mode).af)
}

function mpvArgs(req: PlayRequest, o: PlayOptions, ipc: string): string[] {
  const { settings: s, profile: p } = o
  const args = [
    `--wid=${o.wid}`,
    '--force-window=immediate',
    '--keep-open=no',
    '--idle=no',
    `--input-ipc-server=${ipc}`,
    `--title=${req.title}`,
    // The overlay is the only interface: no mpv OSC, OSD, key or mouse bindings.
    '--osc=no',
    '--osd-level=0',
    '--input-default-bindings=no',
    '--input-vo-keyboard=no',
    '--input-cursor=no',
    '--cursor-autohide=always',
    '--vo=gpu-next',
    '--hwdec=auto-safe',
    // HDR passthrough when the display/compositor is in HDR mode, libplacebo tone-mapping otherwise.
    '--target-colorspace-hint=auto',
    '--hdr-compute-peak=yes',
    '--cache=yes',
    '--demuxer-max-bytes=1GiB',
    '--demuxer-readahead-secs=120',
    `--volume-max=${MAX_VOLUME}`,
    // Silent until the first frame plays, then it fades up to the person's volume.
    '--volume=0',
    ...languageArgs(p, o.tracks),
    `--sub-font-size=${SUB_SIZE[p.subSize]}`,
    `--sub-color=${SUB_COLOR[p.subColor]}`
  ]
  if (p.subBox) args.push('--sub-border-style=background-box', '--sub-back-color=#C0000000')
  // Debanding clears the stepped skies and shadows a web encode's low bitrate leaves; mpv's profile no longer has it.
  if (s.highQuality) args.push('--profile=high-quality', '--deband=yes')
  if (s.smoothMotion) args.push('--video-sync=display-resample', '--interpolation', '--tscale=oversample')
  if (o.hold) args.push('--pause')
  if (s.cih) args.push(`--video-margin-ratio-top=${CIH_MARGIN}`, `--video-margin-ratio-bottom=${CIH_MARGIN}`, '--sub-use-margins=no')
  if (process.platform === 'win32') args.push('--gpu-api=d3d11')
  if (s.audioPassthrough) {
    args.push('--audio-spdif=ac3,eac3,dts,dts-hd,truehd')
    if (process.platform === 'win32') args.push('--ao=wasapi', '--audio-exclusive=yes')
  } else if (s.sound !== 'original') args.push(`--af=${sound(s.sound).af}`, `--audio-swresample-o=${sound(s.sound).mix}`)
  if (o.start > 0) args.push(`--start=${Math.floor(o.start)}`)
  for (const [k, v] of Object.entries(req.headers ?? {})) args.push(`--http-header-fields-append=${k}: ${v}`)
  args.push('--', req.url)
  return args
}

type MpvTrack = {
  id: number
  type: string
  lang?: string
  title?: string
  codec?: string
  'demux-channel-count'?: number
  selected?: boolean
  external?: boolean
}

const track = (t: MpvTrack): Track => ({
  id: t.id,
  lang: t.lang,
  title: t.title,
  codec: t.codec,
  channels: t['demux-channel-count'],
  selected: !!t.selected,
  external: t.external
})

// Subtitles timed to a cinema recording drift against any real release.
const RECORDED = /\b(cam|hdcam|ts|hdts|telesync|tc|telecine)\b/i

/**
 * Online subtitles join the file's own tracks; one is switched on only when subtitles are on and the file has none in
 * the wanted language.
 * ponytail: the addon's order, CAM/TS timings dropped; send videoHash/filename to match the release exactly.
 */
async function addSubtitles(tracks: MpvTrack[], subs: Promise<Subtitle[]>, want: string[], off: boolean) {
  const matches = (lang?: string) => !!lang && (want.includes(lang) || want.includes(lang.split('-')[0]))
  const list = (await subs.catch(() => []))
    .filter((s) => want.includes(s.lang) && !RECORDED.test(s.subtitleFileName ?? ''))
    .sort((a, b) => want.indexOf(a.lang) - want.indexOf(b.lang))
  const covered = off || tracks.some((t) => (t.type === 'sub' || (t.type === 'audio' && t.selected)) && matches(t.lang))
  list.slice(0, 4).forEach((s, i) => send('sub-add', s.url, !covered && i === 0 ? 'select' : 'auto', `Online ${i + 1}`, s.lang))
}

let proc: ChildProcess | null = null
let sock: Socket | null = null
let view: PlayerView | null = null
let tracks: MpvTrack[] = []
/** The volume the person chose, and mpv's own (below it while the sound fades). */
let level = 100
let loud = 0
let fade: ReturnType<typeof setInterval> | undefined

function send(...cmd: (string | number | boolean)[]) {
  sock?.write(JSON.stringify({ command: cmd }) + '\n')
}

/** Moves mpv's volume to `to` over `ms`; a volume press, a new video or another fade cuts it short. */
function ramp(to: number, ms: number, done?: () => void) {
  clearInterval(fade)
  const from = loud
  const t0 = Date.now()
  fade = setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms)
    loud = Math.round(from + (to - from) * k)
    send('set_property', 'volume', loud)
    if (k < 1) return
    clearInterval(fade)
    fade = undefined
    done?.()
  }, 50)
}

export function stop() {
  proc?.kill()
}

export const isPlaying = () => proc !== null

/**
 * Runs one overlay command. Returns the language picked when it changes a track, so main can remember it per series.
 * Fullscreen belongs to the window: main handles it.
 */
export function apply(c: PlayerCommand): TrackChoice | undefined {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  switch (c.kind) {
    case 'pause':
      return void (c.on === undefined ? send('cycle', 'pause') : send('set_property', 'pause', !!c.on))
    case 'seek':
      return void send('seek', Math.max(0, num(c.to)), 'absolute+keyframes')
    case 'skip':
      return void send('seek', num(c.by), 'relative')
    case 'volume':
      clearInterval(fade)
      fade = undefined
      loud = level = Math.max(0, Math.min(MAX_VOLUME, num(c.to)))
      if (view) view.volume = level
      send('set_property', 'mute', false)
      return void send('set_property', 'volume', level)
    case 'mute':
      return void send('cycle', 'mute')
    // A clean quit exits 0, so it never reads as "couldn't play this cópia". The sound fades out first (the
    // overlay darkens the picture meanwhile).
    case 'quit':
      return void ramp(0, FADE_OUT_MS, () => send('quit'))
    case 'audio': {
      const t = tracks.find((x) => x.type === 'audio' && x.id === num(c.id))
      if (!t) return
      send('set_property', 'aid', t.id)
      return t.lang ? { audio: t.lang } : undefined
    }
    case 'sub': {
      if (!num(c.id)) {
        send('set_property', 'sid', 'no')
        return { sub: 'no' }
      }
      const t = tracks.find((x) => x.type === 'sub' && x.id === num(c.id))
      if (!t) return
      send('set_property', 'sid', t.id)
      return t.lang ? { sub: t.lang } : undefined
    }
  }
}

const PROPS = [
  'time-pos',
  'duration',
  'pause',
  'paused-for-cache',
  'seeking',
  'demuxer-cache-time',
  'volume',
  'mute',
  'chapter-list',
  'track-list',
  'video-params'
] as const

export function play(
  req: PlayRequest,
  o: PlayOptions,
  onExit: (st: PlayerState & { volume: number; chapters: PlayerView['chapters'] }) => void,
  onView: (v: PlayerView) => void
) {
  stop()
  sock?.destroy()
  sock = null
  clearInterval(fade)
  fade = undefined
  level = Math.max(0, Math.min(MAX_VOLUME, o.settings.volume))
  loud = 0
  const st: PlayerState = { pos: o.start, dur: 0 }
  const v: PlayerView = {
    req,
    pos: o.start,
    dur: 0,
    paused: false,
    buffering: true,
    started: false,
    ahead: 0,
    volume: level,
    muted: false,
    fullscreen: false,
    chapters: [],
    audio: [],
    subs: [],
    sound: o.settings.audioPassthrough ? undefined : o.settings.sound
  }
  view = v
  tracks = []
  // The Linux AppImage would otherwise ask, mid-film, to check for its own updates. Without WAYLAND_DISPLAY mpv
  // takes X11, the only way it honours --wid (a Wayland context opens a window of its own).
  const { WAYLAND_DISPLAY: _, ...env } = process.env
  const ipc = ipcPath(++spawns)
  const child = spawn(o.bin, mpvArgs(req, o, ipc), { stdio: 'ignore', env: { ...env, DISABLE_AUTO_UPDATES: '1' } })
  proc = child

  // 'error' (mpv missing) and 'exit' can both fire: report once.
  let done = false
  const finish = (error?: string) => {
    if (done) return
    done = true
    if (proc === child) {
      proc = sock = view = null
      clearInterval(fade)
      fade = undefined
    }
    // The person's volume, not wherever the fade out left mpv's.
    onExit({ ...st, volume: v.volume, chapters: v.chapters, error })
  }
  child.on('error', (e: NodeJS.ErrnoException) =>
    finish(e.code === 'ENOENT' ? 'O player sumiu deste computador. Feche e abra o Kalli para prepará-lo de novo.' : e.message)
  )
  child.on('exit', (code) =>
    finish(code && code !== 4 && st.pos === o.start ? `O player não conseguiu tocar esta cópia (código ${code}). Escolha outra em Ver cópias.` : undefined)
  )

  // Time moves every frame: the overlay hears about it four times a second, about anything else at once.
  let timer: ReturnType<typeof setTimeout> | undefined
  const push = (now: boolean) => {
    if (now) clearTimeout(timer), (timer = undefined)
    else if (timer) return
    timer = setTimeout(() => ((timer = undefined), proc === child && onView({ ...v })), now ? 0 : 250)
  }

  const want = SUBS[o.profile.language]
  let opened = false
  // Cinema mode waits for both: the file open (track list) and HDR or not (first frame), in either order.
  let hdr: boolean | undefined
  let reported = false
  const report = () => {
    if (reported || !opened || hdr === undefined) return
    reported = true
    o.hold?.({ hdr })
  }
  let seeking = false
  let waiting = false
  let cacheEnd = 0
  let heard = false

  const update = (name: string, data: unknown) => {
    if (name === 'time-pos' && typeof data === 'number') {
      st.pos = v.pos = data
      v.ahead = Math.max(0, cacheEnd - data)
      if (!v.started && !v.buffering) v.started = true
      // The picture is moving (cinema mode's question answered, if it asked): the sound comes up with it.
      if (v.started && !v.paused && !heard) {
        heard = true
        ramp(level, FADE_IN_MS)
      }
      return push(false)
    }
    if (name === 'duration' && typeof data === 'number') st.dur = v.dur = data
    if (name === 'pause') v.paused = !!data
    if (name === 'seeking') seeking = !!data
    if (name === 'paused-for-cache') waiting = !!data
    v.buffering = seeking || waiting
    if (name === 'demuxer-cache-time' && typeof data === 'number') return void (cacheEnd = data)
    // `v.volume` is the person's (set in `apply`); a fade's every step needn't redraw the overlay.
    if (name === 'volume' && fade) return
    if (name === 'mute') v.muted = !!data
    if (name === 'chapter-list' && Array.isArray(data)) v.chapters = data.map((c: { title?: string; time: number }) => ({ title: c.title, time: c.time }))
    if (name === 'track-list' && Array.isArray(data)) {
      tracks = data as MpvTrack[]
      v.audio = tracks.filter((t) => t.type === 'audio').map(track)
      v.subs = tracks.filter((t) => t.type === 'sub').map(track)
      // The first non-empty track list means the file is open and mpv has picked its tracks.
      if (!opened && tracks.length) {
        opened = true
        const best = bestAudio(v.audio)
        if (best && !best.selected) send('set_property', 'aid', best.id)
        if (want.length) void addSubtitles(tracks, o.subs, want, subsOff(o.profile, o.tracks))
        if (!tracks.some((t) => t.type === 'video')) hdr = false
        report()
      }
    }
    // The first decoded frame says how the picture is encoded: PQ (HDR10, Dolby Vision) or HLG is HDR.
    if (name === 'video-params' && data && typeof data === 'object' && hdr === undefined) {
      hdr = /^(pq|hlg)$/.test((data as { gamma?: string }).gamma ?? '')
      report()
    }
    push(true)
  }

  // mpv creates the IPC endpoint a moment after spawning.
  const attach = (tries = 50) => {
    if (proc !== child) return
    const s = connect(ipc)
    s.once('error', () => tries > 0 && setTimeout(() => attach(tries - 1), 100))
    s.once('connect', () => {
      if (proc !== child) return void s.destroy()
      sock = s
      PROPS.forEach((p, i) => send('observe_property', i + 1, p))
      let buf = ''
      s.on('data', (chunk) => {
        buf += chunk.toString()
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl)
          buf = buf.slice(nl + 1)
          let msg: { event?: string; name?: string; data?: unknown }
          try {
            msg = JSON.parse(line)
          } catch {
            continue
          }
          if (msg.event === 'property-change' && msg.name) update(msg.name, msg.data)
        }
      })
    })
  }
  attach()
}

/** The latest view, for an overlay that just loaded. */
export const current = () => view

const VAAPI: Record<string, Codec> = { HEVCMain10: 'hevc', AV1Profile0: 'av1', H264High: 'avc' }

/** Codecs the GPU decodes. Windows desktop is an RX 7600 (decodes all three); Linux asks VAAPI. */
export async function hwCodecs(): Promise<Codec[] | undefined> {
  if (process.platform === 'win32') return ['hevc', 'av1', 'avc']
  try {
    const { stdout, stderr } = await promisify(execFile)('vainfo', [], { timeout: 5000 })
    const out = stdout + stderr
    return Object.entries(VAAPI).filter(([p]) => new RegExp(`VAProfile${p}\\s*:\\s*VAEntrypointVLD`).test(out)).map(([, c]) => c)
  } catch {
    return undefined
  }
}
