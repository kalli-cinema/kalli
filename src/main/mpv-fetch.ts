import { createHash } from 'node:crypto'
import { chmodSync, createWriteStream, existsSync, renameSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { getJson } from './http.ts'

// Where mpv comes from and how it is fetched, checked and unpacked. No Electron here: the app installs mpv with it on
// first run (mpv.ts) and `scripts/fetch-mpv.ts` bundles it into the installers.

export type Asset = { name: string; size: number; browser_download_url: string; digest?: string | null }
type Source = { api: string; asset: RegExp }

// CI builds pass their token: GitHub allows an anonymous runner IP only 60 API calls an hour.
const GITHUB = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'Kalli',
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` })
}

/** Windows: zhongfly's daily mpv builds (7z, opened with 7-Zip compiled to WASM). Linux: an AppImage that needs no FUSE. */
export function source(platform: string = process.platform, arch: string = process.arch): Source {
  const a = arch === 'arm64' ? 'aarch64' : 'x86_64'
  return platform === 'win32'
    ? { api: 'https://api.github.com/repos/zhongfly/mpv-winbuild/releases/latest', asset: new RegExp(`^mpv-${a}-\\d{8}-git-[0-9a-f]+\\.7z$`) }
    : { api: 'https://api.github.com/repos/pkgforge-dev/mpv-AppImage/releases/latest', asset: new RegExp(`^mpv-v[\\d.]+-anylinux-${a}\\.AppImage$`) }
}

export async function latest(src: Source): Promise<Asset> {
  const release = await getJson<{ assets: Asset[] }>(src.api, { headers: GITHUB })
  const asset = release.assets.find((a) => src.asset.test(a.name))
  if (!asset) throw new Error('Não encontrei o player para este computador. Tente de novo mais tarde.')
  return asset
}

export async function download(asset: Asset, to: string, progress: (p: number) => void = () => {}) {
  const res = await fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Kalli' }, signal: AbortSignal.timeout(20 * 60_000) })
  if (!res.ok || !res.body) throw new Error(`O download do player falhou (erro ${res.status}). Tente de novo.`)
  const total = Number(res.headers.get('content-length')) || asset.size
  const hash = createHash('sha256')
  let got = 0
  let shown = 0
  await pipeline(
    Readable.fromWeb(res.body as never),
    async function* (src: AsyncIterable<Buffer>) {
      for await (const chunk of src) {
        hash.update(chunk)
        got += chunk.byteLength
        if (total && got / total - shown >= 0.01) progress((shown = got / total))
        yield chunk
      }
    },
    createWriteStream(to)
  )
  // GitHub publishes a sha256 for every release asset.
  if (asset.digest && asset.digest !== `sha256:${hash.digest('hex')}`) throw new Error('O player chegou corrompido. Tente de novo.')
}

/** The player inside its folder: `resources/mpv` in the installers, `userData/mpv` when fetched on first run. */
export const BIN = process.platform === 'win32' ? 'mpv.exe' : 'mpv.AppImage'

/** Puts a downloaded player into `out`: Windows' 7z is unpacked, Linux's AppImage moved in and made executable. */
export async function place(archive: string, out: string) {
  if (process.platform !== 'win32') {
    renameSync(archive, join(out, BIN))
    return chmodSync(join(out, BIN), 0o755)
  }
  const { default: SevenZip } = await import('7z-wasm')
  const z = await SevenZip({ print: () => {}, printErr: () => {} })
  z.FS.mkdir('/in')
  z.FS.mount(z.NODEFS, { root: dirname(archive) }, '/in')
  z.FS.mkdir('/out')
  z.FS.mount(z.NODEFS, { root: out }, '/out')
  z.callMain(['x', `/in/${basename(archive)}`, '-o/out', '-y'])
  if (!existsSync(join(out, BIN))) throw new Error('Não deu para abrir o pacote do player. Tente de novo.')
}
