import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { Notification, UpdateStatus } from '../shared/types.ts'

// Updates from this repository's GitHub Releases (package.json `build.publish`), built by
// .github/workflows/release.yml. electron-updater reads the release's latest*.yml and checks each download's
// sha512 against it; trust is HTTPS to those releases, the same as downloading the installer by hand.
const { autoUpdater, CancellationToken } = electronUpdater

const EVERY = 6 * 3600_000
// A .deb installs through pkexec, which asks for a password: never spring that on someone closing the app.
const DEB = process.platform === 'linux' && !process.env.APPIMAGE

let status: UpdateStatus = { state: 'none', version: app.getVersion(), onQuit: !DEB }
let token: InstanceType<typeof CancellationToken> | null = null
let playing = () => false

export const current = () => status

/**
 * Checks now and every 6 h, and downloads a newer release in the background, never while a video plays (the film
 * owns the connection). A downloaded update installs when Kalli closes (Windows, AppImage) or from Perfil.
 */
export function start(isPlaying: () => boolean, notify: (n: Notification) => void) {
  // `bun dev` and unpacked builds aren't installed: nothing to update.
  if (!app.isPackaged) return
  playing = isPlaying
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = !DEB
  autoUpdater.logger = null
  autoUpdater.on('update-available', (info) => {
    status = { ...status, state: 'available', next: info.version }
    download()
  })
  autoUpdater.on('download-progress', (p) => (status = { ...status, state: 'downloading', progress: p.percent / 100 }))
  autoUpdater.on('update-downloaded', (info) => {
    status = { ...status, state: 'ready', next: info.version, progress: undefined }
    notify({
      kind: 'update',
      title: `Kalli ${info.version} pronto`,
      body: DEB ? 'Instale em Perfil → Preferências.' : 'Entra quando você fechar o Kalli, ou agora em Perfil → Preferências.'
    })
  })
  // Offline, GitHub down, no release yet: try again at the next check.
  autoUpdater.on('error', () => status.state !== 'ready' && (status = { ...status, state: 'none', progress: undefined }))
  const check = () => {
    if (playing()) return
    if (status.state === 'none') void autoUpdater.checkForUpdates().catch(() => {})
    // A download that failed or stepped aside for a film tries again.
    else if (status.state === 'available') download()
  }
  check()
  setInterval(check, EVERY).unref()
}

function download() {
  if (token || playing() || status.state === 'ready') return
  token = new CancellationToken()
  autoUpdater
    .downloadUpdate(token)
    .catch(() => status.state !== 'ready' && (status = { ...status, state: 'available', progress: undefined }))
    .finally(() => (token = null))
}

/** A video started (true) or ended (false): a download in flight steps aside, and picks up again afterwards. */
export function hold(on: boolean) {
  if (on) token?.cancel()
  else if (status.state === 'available') download()
}

/** Installs the downloaded update now and starts the new version. The caller has already let the window close. */
export function install() {
  if (status.state !== 'ready') throw new Error('Nenhuma atualização pronta.')
  autoUpdater.quitAndInstall(true, true)
}
