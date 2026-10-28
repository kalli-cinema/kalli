// Stremio addon protocol shapes: https://github.com/Stremio/stremio-addon-sdk/tree/master/docs/api

export type ExtraProp = { name: string; isRequired?: boolean; options?: string[] }
export type CatalogDef = { type: string; id: string; name?: string; extra?: ExtraProp[] }
export type ResourceDef = string | { name: string; types: string[]; idPrefixes?: string[] }

export type Manifest = {
  id: string
  name: string
  version: string
  description?: string
  logo?: string
  types: string[]
  resources: ResourceDef[]
  catalogs: CatalogDef[]
  idPrefixes?: string[]
}

export type Addon = { transportUrl: string; manifest: Manifest }

export type MetaPreview = {
  id: string
  type: string
  name: string
  poster?: string
  background?: string
  logo?: string
  releaseInfo?: string
  imdbRating?: string
  description?: string
  genres?: string[]
}

export type Video = {
  id: string
  title?: string
  name?: string
  season?: number
  episode?: number
  released?: string
  thumbnail?: string
  overview?: string
}

export type Meta = MetaPreview & {
  runtime?: string
  year?: number
  cast?: string[]
  director?: string[]
  videos?: Video[]
  /** Cinemeta: YouTube trailers. */
  trailerStreams?: { ytId: string; title?: string }[]
}

export type Stream = {
  url?: string
  infoHash?: string
  fileIdx?: number
  ytId?: string
  externalUrl?: string
  name?: string
  title?: string
  description?: string
  /** `tracker:<url>` and `dht:<infoHash>` entries for P2P streams. */
  sources?: string[]
  behaviorHints?: {
    bingeGroup?: string
    filename?: string
    videoSize?: number
    proxyHeaders?: { request?: Record<string, string> }
  }
  /** Set by us: which addon returned it. */
  addon?: string
}

export type StreamResult = { streams: Stream[]; failed: number; asked: number }

/** A link checked before play: its host's speed, or `dead` when it answers with an error instead of video. */
export type Probe = { mbps?: number; dead?: boolean }

/** `subtitles` resource item; `lang` is ISO 639-2 (OpenSubtitles uses `pob` for Brazilian Portuguese). */
export type Subtitle = {
  id: string
  url: string
  lang: string
  /** OpenSubtitles extra: the release the subtitle was timed to. */
  subtitleFileName?: string
}


/** Machine-wide choices: this computer's GPU, display, receiver and connection. Per-person ones live in `Profile`. */
export type Settings = {
  /** Bitstream TrueHD/Atmos/DTS-HD to an AVR instead of decoding. */
  audioPassthrough: boolean
  /** mpv `high-quality` profile (ewa scalers) plus debanding. Turn off on weak iGPUs if frames drop. */
  highQuality: boolean
  /** Resample to the display's refresh rate so pans don't judder (`display-resample` + interpolation). */
  smoothMotion: boolean
  /**
   * Cinema mode: each session (a film, or episodes in a row) turns Windows HDR on for an HDR film; kept only once
   * confirmed within 15 s, and put back when the session ends.
   */
  cinema: boolean
  /** How decoded audio is shaped for this room's speakers (no effect while bitstreaming to a receiver). */
  sound: SoundMode
  /** The next episode downloads while this one plays (best quality), and is deleted once watched. */
  ahead: boolean
  /** Soft sounds as focus moves and things are picked. */
  uiSounds: boolean
  /** A muted trailer fades in behind a title's page after a few seconds. */
  trailers: boolean
  /** Pre-show: two trailers, with sound, before a film started from the beginning; A goes straight to the film. */
  preshow: boolean
  /**
   * A 2.39:1 projector screen zoomed to constant image height: the interface and every film stay inside the
   * screen's band (a 16:9 film pillarboxed in it), nothing lands on the masking above and below.
   */
  cih: boolean
  /** Philips Hue bridge address, its user (a secret, made when pairing) and the room that dims; empty = no Hue. */
  hueBridge: string
  hueUser: string
  hueRoom: string
  /** Any other system (Home Assistant...): POSTed `{ event: 'play' | 'pause' | 'credits' | 'stop' }`. Empty = none. */
  lightsWebhook: string
  /** Highest resolution worth picking (2160, 1080, 720): above it a cópia only plays when nothing else does. */
  maxRes: number
  /** Empty = <Videos>/Kalli (or <Videos>/kaleidescape-de-pobre when a library from before the rename exists) */
  downloadDir: string
  /** TMDB API key (v3) or read token (v4): titles, synopses and episode names in PT-BR. */
  tmdbKey: string
  /** Start hidden in the tray at login, waiting for the Guide button. Off unless the user turns it on. */
  autostart: boolean
  /** Closing the window keeps Kalli in the tray (with a notification) instead of quitting. Off unless chosen. */
  closeToTray: boolean
  /** The first-run welcome (choosing sources) is done. */
  onboarded: boolean
  /** Player volume (0–`MAX_VOLUME`), kept from the last play. */
  volume: number
}

/**
 * Audio and subtitles for every play. It steers the pick (a dubbed cópia or not) and mpv's tracks.
 * dub          Portuguese audio; only forced subtitles
 * original-pt  original audio, Portuguese subtitles
 * original-en  original audio, English subtitles
 * original     original audio, no subtitles
 */
export type Language = 'dub' | 'original-pt' | 'original-en' | 'original'

/**
 * original  the mix as released
 * dialogue  dialogue lifted in the downmix, loud effects gently tamed (TV and laptop speakers)
 * night     strong compression: whispers and explosions at one level
 */
export type SoundMode = 'original' | 'dialogue' | 'night'

/** A Philips Hue room or zone. */
export type LightRoom = { id: string; name: string }

/** Volume goes past 100% (mpv amplifies) for quiet mixes and weak laptop speakers. */
export const MAX_VOLUME = 200

export type Accent = 'edition' | 'orange' | 'rose' | 'violet' | 'sky' | 'emerald'

/** Preset profile pictures, drawn by `scripts/brand.py` into `renderer/src/assets/avatars/<id>.svg`. */
export const AVATARS = ['pipoca', 'claquete', 'rolo', 'oculos', 'ingresso', 'controle'] as const
export type AvatarId = (typeof AVATARS)[number]

/** One person in the household: their own look, language and watch history. */
export type Profile = {
  id: string
  name: string
  /** Replaces edition yellow while this profile is active. */
  accent: Accent
  /** A preset picture on the accent colour; empty shows the name's initial. */
  avatar: AvatarId | ''
  language: Language
  /** Subtitles start on, in the preset's language. Off (the default): only forced ones; a pick in the player wins for that title. */
  subtitles: boolean
  subSize: 'small' | 'medium' | 'large'
  subColor: 'white' | 'yellow'
  /** A dark band behind subtitles instead of an outline. */
  subBox: boolean
  /** Openings and recaps are skipped without asking. */
  autoSkip: boolean
  /** The next episode starts by itself when the credits roll. */
  autoNext: boolean
}

export type Profiles = { profiles: Profile[]; active: string }

/** The player (mpv) is fetched once on first run when the system has none. `progress` is 0–1. */
export type PlayerStatus = { state: 'ready' | 'installing' | 'error'; progress?: number; error?: string }

/**
 * Kalli's own updates (GitHub Releases). `version` is the running one, `next` the newer release; `progress` is 0–1
 * while downloading. `onQuit`: a ready update installs by itself when Kalli closes (not for a .deb, which needs a password).
 */
export type UpdateStatus = {
  state: 'none' | 'available' | 'downloading' | 'ready'
  version: string
  next?: string
  progress?: number
  onQuit: boolean
}

export type PlayerState = { pos: number; dur: number; error?: string }

/** An audio or subtitle track of the playing file (mpv's `track-list`). */
export type Track = { id: number; lang?: string; title?: string; codec?: string; channels?: number; selected: boolean; external?: boolean }

/** What the player overlay draws, pushed by main while mpv plays. */
export type PlayerView = {
  req: PlayRequest
  pos: number
  dur: number
  paused: boolean
  /** Waiting for data (start, seek, slow link). */
  buffering: boolean
  /** The first frame is up. */
  started: boolean
  /** Seconds buffered ahead of `pos`. */
  ahead: number
  volume: number
  muted: boolean
  fullscreen: boolean
  chapters: { title?: string; time: number }[]
  audio: Track[]
  subs: Track[]
  /** The screen just moved into HDR and waits for a yes; it goes back by itself at `until` (epoch ms). */
  cinema?: { until: number }
  /** The sound mode in use; undefined while bitstreaming to a receiver, where it can't apply. */
  sound?: SoundMode
}

/** The only things the overlay may ask of mpv (main maps each to an mpv command; nothing else reaches it). */
export type PlayerCommand =
  | { kind: 'pause'; on?: boolean }
  | { kind: 'seek'; to: number }
  | { kind: 'skip'; by: number }
  | { kind: 'volume'; to: number }
  | { kind: 'mute' }
  | { kind: 'audio'; id: number }
  /** 0 turns subtitles off. */
  | { kind: 'sub'; id: number }
  | { kind: 'fullscreen' }
  | { kind: 'quit' }
  /** The answer to `PlayerView.cinema`: keep HDR for this session, or go back. */
  | { kind: 'cinema'; keep: boolean }
  /** Changes `Settings.sound` and applies it at once. */
  | { kind: 'sound'; mode: SoundMode }
  /** Ends the film and opens this title's page in the app (a recommendation picked on the end card). */
  | { kind: 'open'; meta: MetaPreview }

/** What follows a film, from TMDB: the next film of its collection, and films like it (unwatched, not disliked). */
export type After = { next?: Meta; recs: Meta[] }

/** A press worth feeling in the hands: Play pressed (the other moments are main's own: the film starts, credits roll). */
export type Rumble = 'play'

/** A series' audio and subtitle language once someone picks them by hand; later episodes open with them. */
export type TrackChoice = { audio?: string; sub?: string | 'no' }

export type TorrentRef = { infoHash: string; fileIdx?: number; trackers?: string[] }

/** `key` is the video id: the movie id, or `tt…:season:episode` for an episode. */
export type PlayRequest = {
  key: string
  metaId: string
  type: string
  /** Direct link, or the magnet for a P2P cópia (then `torrent` is set). */
  url: string
  torrent?: TorrentRef
  title: string
  headers?: Record<string, string>
  poster?: string
  background?: string
  /** Cópia description shown in Continuar and on the title card, e.g. "4K · Dolby Vision · Atmos". */
  label: string
  /** The episode after this one: Continuar offers it once this one is watched. */
  next?: UpNextRef
  /** The next best cópias, tried in order if this one fails to open. Not saved with the progress. */
  fallbacks?: PlayRequest[]
}

/** A Bluetooth controller Windows knows (paired) or found nearby in pairing mode. */
export type BtDevice = { id: string; name: string; connected?: boolean }

/** Controllers as Perfil → Controles shows them: in use right now (SDL), and paired over Bluetooth. */
export type Controllers = {
  connected: { name: string; battery: 'empty' | 'low' | 'medium' | 'full' | 'wired' | 'max' | null }[]
  paired: BtDevice[]
  /** Bluetooth pairing from inside the app (Windows only). */
  bluetooth: boolean
}

/** A notification: slides in at the bottom right of the app and of the player, then leaves on its own. */
export type Notification = {
  kind: 'download' | 'gamepad' | 'battery' | 'player' | 'update'
  title: string
  body?: string
  /** Something went wrong: drawn in the alert colour. */
  error?: boolean
}

export type UpNextRef = { key: string; title: string; background?: string }

/** A finished episode's successor, offered in Continuar until it is started. */
export type UpNext = UpNextRef & { metaId: string; type: string; poster?: string; at: number }

/** One profile's watch history. Maps by video id (`progress`, `watched`) or by title id (the rest). */
export type History = {
  progress: Record<string, Progress>
  /** Video ids watched to the credits. */
  watched: Record<string, number>
  upNext: Record<string, UpNext>
  /** Removed from Continuar at this time; anything newer brings the title back. */
  dismissed: Record<string, number>
  tracks: Record<string, TrackChoice>
  /** A film rated on its end card: 1 liked, -1 not for me (never recommended again, nor its own recommendations). */
  rated: Record<string, 1 | -1>
}

/** Saved on exit with the request, so Continuar resumes the same cópia without re-ranking. */
export type Progress = PlayRequest & { pos: number; dur: number; at: number }

/** `ahead`: fetched by itself while the episode before it plays; never touches an existing download, deleted once watched. */
export type DownloadRequest = PlayRequest & { filename?: string; ahead?: boolean }

export type Download = DownloadRequest & {
  file: string
  size: number
  received: number
  state: 'downloading' | 'paused' | 'done' | 'error'
  error?: string
  at: number
}

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'a' | 'b' | 'x' | 'y'
  | 'lb' | 'rb' | 'lt' | 'rt'
  | 'start' | 'back' | 'guide'
