// Build step for the installers (`bun run dist`): puts the latest mpv build for this platform into resources/mpv,
// which electron-builder ships as `<install>/resources/mpv`, where mpv.ts looks first.
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { download, latest, place, source } from '../src/main/mpv-fetch.ts'

const dir = join(import.meta.dirname, '..', 'resources')
const out = join(dir, 'mpv')
const asset = await latest(source())
const file = join(dir, asset.name)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
try {
  await download(asset, file)
  await place(file, out)
} finally {
  rmSync(file, { force: true })
}
console.log(`mpv: ${asset.name}`)
