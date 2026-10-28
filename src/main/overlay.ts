import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { Action, Notification, PlayerView } from '../shared/types.ts'

// The player's controls: a transparent window owned by Kalli's, laid exactly over it, above the mpv it embeds.
// Owned windows stay above their owner and follow it to fullscreen; bounds are re-applied on every move.

let overlay: BrowserWindow | null = null

function fit(owner: BrowserWindow) {
  overlay?.setBounds(owner.getContentBounds())
}

/** `onLost` runs if the overlay can't load or its renderer dies: without it nobody could stop the video. */
export function open(owner: BrowserWindow, onLost: () => void) {
  if (overlay) return overlay.focus()
  const o = new BrowserWindow({
    parent: owner,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      backgroundThrottling: false
    }
  })
  overlay = o
  const follow = () => fit(owner)
  for (const e of ['move', 'resize', 'enter-full-screen', 'leave-full-screen'] as const) owner.on(e as 'move', follow)
  o.on('closed', () => {
    for (const e of ['move', 'resize', 'enter-full-screen', 'leave-full-screen'] as const) owner.off(e as 'move', follow)
    if (overlay === o) overlay = null
  })
  o.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  o.webContents.on('will-navigate', (e) => e.preventDefault())
  // F11 toggles fullscreen here; the default menu's own F11 would toggle a second time and cancel it out.
  o.webContents.on('before-input-event', (e, input) => {
    if (input.key !== 'F11') return
    e.preventDefault()
    if (input.type === 'keyDown' && !input.isAutoRepeat) owner.setFullScreen(!owner.isFullScreen())
  })
  o.webContents.on('did-fail-load', onLost)
  o.webContents.on('render-process-gone', onLost)
  o.once('ready-to-show', () => {
    fit(owner)
    o.show()
    o.focus()
  })
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev) void o.loadURL(`${dev}#player`)
  else void o.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'player' })
}

export function close() {
  overlay?.destroy()
  overlay = null
}

export const isOpen = () => !!overlay
export const focus = () => overlay?.focus()

export const sendView = (v: PlayerView) => overlay?.webContents.send('player:view', v)
export const sendInput = (a: Action) => overlay?.webContents.send('input', a)
export const sendNotify = (n: Notification) => overlay?.webContents.send('notify', n)
export const owns = (contents: Electron.WebContents) => overlay?.webContents === contents
