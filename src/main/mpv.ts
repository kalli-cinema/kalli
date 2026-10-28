import { app } from 'electron'
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PlayerStatus } from '../shared/types.ts'
import { BIN, download, latest, place, source } from './mpv-fetch.ts'

// Plug and play: nobody installs mpv by hand. The installers ship it (resources/mpv), a system mpv on PATH is used
// as is, and otherwise the first run fetches one into userData/mpv.

const home = () => join(app.getPath('userData'), 'mpv')
const fetched = () => join(home(), BIN)
const bundled = () => join(process.resourcesPath, 'mpv', BIN)

let status: PlayerStatus = { state: 'installing' }
let listener: (s: PlayerStatus) => void = () => {}
const set = (s: PlayerStatus) => listener((status = s))

export const playerStatus = () => status
export const watch = (cb: (s: PlayerStatus) => void) => void (listener = cb)

let binary: Promise<string> | null = null

/** The mpv binary to spawn; installs it on first use. A failure is reported and retried on the next call. */
export function ensure(): Promise<string> {
  binary ??= find().then(
    (bin) => (set({ state: 'ready' }), bin),
    (e: Error) => {
      binary = null
      set({ state: 'error', error: e.message })
      throw e
    }
  )
  return binary
}

async function find() {
  if (existsSync(bundled())) return bundled()
  if (await onPath()) return 'mpv'
  if (!existsSync(fetched())) await install()
  return fetched()
}

const onPath = () =>
  promisify(execFile)('mpv', ['--version'], { timeout: 5000 }).then(
    () => true,
    () => false
  )

async function install() {
  if (process.platform !== 'win32' && process.platform !== 'linux') throw new Error('Instale o mpv para assistir neste sistema.')
  set({ state: 'installing', progress: 0 })
  const asset = await latest(source())
  const file = join(app.getPath('userData'), 'mpv-download')
  // Unpacked next door and moved in whole: a crash mid-install never leaves a half player behind.
  const out = home() + '.new'
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  try {
    await download(asset, file, (progress) => set({ state: 'installing', progress }))
    await place(file, out)
    rmSync(home(), { recursive: true, force: true })
    renameSync(out, home())
  } finally {
    rmSync(file, { force: true })
    rmSync(out, { recursive: true, force: true })
  }
}
