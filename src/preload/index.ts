import { contextBridge, ipcRenderer } from 'electron'
import type { Codec } from '../shared/ranking.ts'
import type { IntroDb } from '../shared/segments.ts'
import type {
  Action,
  Addon,
  After,
  BtDevice,
  Controllers,
  Download,
  DownloadRequest,
  Meta,
  MetaPreview,
  Notification,
  History,
  LightRoom,
  PlayerCommand,
  PlayerState,
  PlayerView,
  Probe,
  PlayerStatus,
  PlayRequest,
  Profile,
  Profiles,
  Rumble,
  Settings,
  StreamResult,
  UpdateStatus
} from '../shared/types.ts'

const on = <T>(channel: string, cb: (v: T) => void) => {
  const fn = (_: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, fn)
  return () => void ipcRenderer.off(channel, fn)
}

const api = {
  addons: (): Promise<Addon[]> => ipcRenderer.invoke('addons'),
  previewAddon: (url: string): Promise<Addon> => ipcRenderer.invoke('addon:preview', url),
  installAddon: (url: string): Promise<Addon[]> => ipcRenderer.invoke('addon:install', url),
  removeAddon: (url: string): Promise<Addon[]> => ipcRenderer.invoke('addon:remove', url),
  catalog: (url: string, type: string, id: string, extra?: Record<string, string>): Promise<MetaPreview[]> =>
    ipcRenderer.invoke('catalog', url, type, id, extra),
  /** `full` also localizes every episode (entry page); the wall only needs title and synopsis. */
  meta: (type: string, id: string, full = false): Promise<Meta | null> => ipcRenderer.invoke('meta', type, id, full),
  streams: (type: string, id: string): Promise<StreamResult> => ipcRenderer.invoke('streams', type, id),
  bandwidth: (url: string, headers?: Record<string, string>): Promise<Probe> =>
    ipcRenderer.invoke('bandwidth', url, headers),
  hw: (): Promise<Codec[] | undefined> => ipcRenderer.invoke('hw'),
  settings: (): Promise<Settings> => ipcRenderer.invoke('settings'),
  setSettings: (patch: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:set', patch),
  profiles: (): Promise<Profiles> => ipcRenderer.invoke('profiles'),
  /** Changes the active profile. */
  setProfile: (patch: Partial<Profile>): Promise<Profiles> => ipcRenderer.invoke('profile:set', patch),
  addProfile: (name: string): Promise<Profiles> => ipcRenderer.invoke('profile:add', name),
  switchProfile: (id: string): Promise<Profiles> => ipcRenderer.invoke('profile:switch', id),
  removeProfile: (id: string): Promise<Profiles> => ipcRenderer.invoke('profile:remove', id),
  player: (): Promise<PlayerStatus> => ipcRenderer.invoke('player'),
  installPlayer: (): Promise<void> => ipcRenderer.invoke('player:install'),
  /** Kalli's own update: what is running, and a newer version downloading or ready. */
  update: (): Promise<UpdateStatus> => ipcRenderer.invoke('update'),
  /** Quits, installs the ready update and starts the new version. */
  installUpdate: (): Promise<void> => ipcRenderer.invoke('update:install'),
  history: (): Promise<History> => ipcRenderer.invoke('history'),
  /** Takes a title out of Continuar until something newer happens to it. */
  forget: (metaId: string): Promise<History> => ipcRenderer.invoke('history:forget', metaId),
  /** 👍 1, 👎 -1, 0 takes it back. */
  rate: (metaId: string, value: 1 | -1 | 0): Promise<History> => ipcRenderer.invoke('history:rate', metaId, value),
  /** The end card of a film: the next of its collection and films like it (empty without a TMDB key). */
  after: (metaId: string): Promise<After> => ipcRenderer.invoke('after', metaId),
  /** TheIntroDB's skippable stretches for a video key (null when unknown); the overlay uses them without named chapters. */
  skips: (key: string): Promise<IntroDb | null> => ipcRenderer.invoke('skips', key),
  rumble: (kind: Rumble): Promise<void> => ipcRenderer.invoke('pad:rumble', kind),
  play: (req: PlayRequest): Promise<void> => ipcRenderer.invoke('play', req),
  downloads: (): Promise<Download[]> => ipcRenderer.invoke('downloads'),
  /** Undefined when a download ahead isn't worth it (one exists already, or the disk is short of space). */
  download: (req: DownloadRequest): Promise<Download | undefined> => ipcRenderer.invoke('download:add', req),
  pauseDownload: (key: string): Promise<void> => ipcRenderer.invoke('download:pause', key),
  resumeDownload: (key: string): Promise<void> => ipcRenderer.invoke('download:resume', key),
  /** Stops a download and deletes its file. */
  removeDownload: (key: string): Promise<Download[]> => ipcRenderer.invoke('download:remove', key),
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  controllers: (): Promise<Controllers> => ipcRenderer.invoke('controllers'),
  /** Bluetooth controllers in pairing mode nearby; takes about 30 s. */
  scanControllers: (): Promise<BtDevice[]> => ipcRenderer.invoke('controllers:scan'),
  pairController: (id: string): Promise<Controllers> => ipcRenderer.invoke('controllers:pair', id),
  forgetController: (id: string): Promise<Controllers> => ipcRenderer.invoke('controllers:forget', id),
  cancelPlay: (): Promise<void> => ipcRenderer.invoke('play:cancel'),
  /** Follows a link to where it really serves from, so a play pressed next starts without the detour. */
  warmPlay: (url: string, headers?: Record<string, string>): Promise<void> => ipcRenderer.invoke('play:warm', url, headers),
  /** The local page that plays a YouTube trailer, muted unless `sound`; undefined for an id that isn't one. */
  trailerUrl: (ytId: string, sound = false): Promise<string | undefined> => ipcRenderer.invoke('trailer', ytId, sound),
  /** Finds the Hue bridge and waits (about 30 s) for its button; returns its rooms. */
  pairLights: (): Promise<LightRoom[]> => ipcRenderer.invoke('lights:pair'),
  lightRooms: (): Promise<LightRoom[]> => ipcRenderer.invoke('lights:rooms'),
  /** Player overlay only: what is playing now, and the playback commands main allows. */
  playerView: (): Promise<PlayerView | null> => ipcRenderer.invoke('player:view'),
  playerDo: (c: PlayerCommand): Promise<void> => ipcRenderer.invoke('player:do', c),
  onPlayerView: (cb: (v: PlayerView) => void) => on('player:view', cb),
  onInput: (cb: (a: Action) => void) => on('input', cb),
  onDownload: (cb: (d: Download) => void) => on('download', cb),
  onBigPicture: (cb: (on: boolean) => void) => on('bigpicture', cb),
  setBigPicture: (on: boolean): Promise<void> => ipcRenderer.invoke('bigpicture:set', on),
  onPlayerExit: (cb: (st: PlayerState) => void) => on('player:exit', cb),
  /** A title picked on a film's end card, to open once the player is gone. */
  onOpen: (cb: (m: MetaPreview) => void) => on('open', cb),
  onPlayerStatus: (cb: (s: PlayerStatus) => void) => on('player:status', cb),
  onNotify: (cb: (n: Notification) => void) => on('notify', cb)
}

export type Api = typeof api

contextBridge.exposeInMainWorld('kalli', api)
