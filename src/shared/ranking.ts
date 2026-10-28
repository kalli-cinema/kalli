import type { Stream, Track } from './types.ts'

export type Codec = 'hevc' | 'av1' | 'avc'

export type Parsed = {
  res: number // 2160 | 1080 | 720 | 480 | 0 (unknown)
  hdr: 'DV' | 'HDR10+' | 'HDR' | null
  source: 'REMUX' | 'BluRay' | 'WEB-DL' | 'WEBRip' | 'HDTV' | 'CAM' | null
  codec: Codec | null
  /** `TrueHD Atmos` is lossless (discs); `DD+ Atmos` is the lossy one streaming services ship. */
  audio: 'TrueHD Atmos' | 'DD+ Atmos' | 'TrueHD' | 'DTS-HD' | 'DD+' | 'DD' | 'AAC' | null
  sizeGB: number | null
  seeders: number | null
  /** Debrid cache state; null when the addon doesn't say. */
  cached: boolean | null
  kind: 'http' | 'torrent' | 'other'
  /** Portuguese audio: dub (only), dual (Portuguese + original), leg (original with Portuguese subtitles), null unknown. */
  lang: 'dub' | 'dual' | 'leg' | null
  /** Something that spoils an otherwise good cópia: 3D, burned-in subtitles, an upscale. */
  flaw: '3D' | 'hardsub' | 'upscale' | null
}

/**
 * instant  plays now, bandwidth has headroom (or is unknown)
 * tight    plays now, bitrate is close to measured bandwidth
 * download bitrate exceeds bandwidth: download first
 * p2p      plain torrent, depends on the swarm
 * uncached debrid hasn't got it yet
 * unplayable trailer / external link
 * dead     the link answered with an error, a web page or a debrid explainer video instead of the file
 */
export type Verdict = 'instant' | 'tight' | 'download' | 'p2p' | 'uncached' | 'unplayable' | 'dead'

export type Ranked = {
  stream: Stream
  info: Parsed
  quality: number
  /** How well it fits the person: wanted audio, resolution cap. */
  fit: number
  /** Worth downloading: quality and fit, plus swarm health for torrents; ignores whether it streams now. */
  keep: number
  rank: number
  verdict: Verdict
  /** From the file size; null when the addon doesn't say. */
  bitrateMbps: number | null
  /** What the verdict assumed: the bitrate, or a typical one for the resolution when the size is unknown. */
  needMbps: number | null
  /** Measured speed of this cópia's host, when it was probed. */
  linkMbps?: number
  softwareDecode: boolean
}

export type RankContext = {
  runtimeMin?: number
  /** Measured Mbps by host (`hostOf`); 0 = the probe failed. Hosts not in it are unknown. */
  bandwidth?: Record<string, number>
  /** Codecs the GPU decodes in hardware. Undefined = unknown, no penalty. */
  hwCodecs?: Codec[]
  /** The profile's audio: Portuguese (`dub`) or the original. Undefined = no preference. */
  audio?: 'dub' | 'original'
  /** Links checked before play that answered with an error instead of video (by URL). */
  dead?: Record<string, boolean>
  /** Resolution cap (Settings.maxRes). */
  maxRes?: number
}

/** Bandwidth is measured per host: addons serve from different CDNs. */
export const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

const first = <T>(text: string, table: [RegExp, T][]): T | null =>
  table.find(([re]) => re.test(text))?.[1] ?? null

export function parseStream(s: Stream): Parsed {
  const text = [s.name, s.title, s.description, s.behaviorHints?.filename].filter(Boolean).join('\n')

  const sizeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(GB|GiB|MB|MiB)\b/i)
  const sizeGB = s.behaviorHints?.videoSize
    ? s.behaviorHints.videoSize / 1e9
    : sizeMatch
      ? parseFloat(sizeMatch[1].replace(',', '.')) / (/^m/i.test(sizeMatch[2]) ? 1000 : 1)
      : null

  // Addons write 👤 12, 👥 12 or "Seeders: 12".
  const seeds = text.match(/(?:👤|👥|\bseed(?:er)?s?:?)\s*(\d+)/i)

  const source = first(text, [
    [/\b(cam|hdcam|ts|hdts|telesync|tc|telecine|scr|screener)\b/i, 'CAM' as const],
    [/remux/i, 'REMUX' as const],
    [/\b(blu-?ray|bdrip|brrip|bdremux)\b/i, 'BluRay' as const],
    [/\bweb-?dl\b/i, 'WEB-DL' as const],
    [/\b(webrip|web)\b/i, 'WEBRip' as const],
    [/\bhdtv\b/i, 'HDTV' as const]
  ])

  return {
    res: first(text, [
      [/\b(2160p|4k|uhd)\b/i, 2160],
      [/\b1080p\b/i, 1080],
      [/\b720p\b/i, 720],
      [/\b(480p|576p|sd)\b/i, 480]
    ]) ?? 0,
    hdr: first(text, [
      [/\b(DV|DoVi|Dolby[ .]?Vision)\b/i, 'DV' as const],
      [/\bHDR10(\+|plus)/i, 'HDR10+' as const],
      [/\bHDR(10)?\b/i, 'HDR' as const]
    ]),
    source,
    codec: first(text, [
      [/\b(x265|h\.?265|hevc)\b/i, 'hevc' as const],
      [/\bav1\b/i, 'av1' as const],
      [/\b(x264|h\.?264|avc)\b/i, 'avc' as const]
    ]),
    audio: parseAudio(text, source),
    sizeGB,
    seeders: seeds ? Number(seeds[1]) : null,
    cached: /\[\w{2}\+\]|⚡/.test(text) ? true : /\[\w{2} download\]|⬇/i.test(text) ? false : null,
    kind: s.url ? 'http' : s.infoHash ? 'torrent' : 'other',
    lang: parseLang(text),
    flaw: first(text, [
      [/\b(3d|h-?sbs|h-?ou|half-?sbs)\b/i, '3D' as const],
      [/\b(hc|hardsub(bed|s)?|hard-?coded)\b/i, 'hardsub' as const],
      [/\b(upscaled?|ai[- .]?upscale)\b/i, 'upscale' as const]
    ])
  }
}

const DDP = /\b(ddp|dd\+|e-?ac-?3)/i

// Atmos rides on lossless TrueHD on discs and on lossy DD+ on streaming services; a bare "Atmos" follows the source.
function parseAudio(text: string, source: Parsed['source']): Parsed['audio'] {
  if (/atmos/i.test(text))
    return /true-?hd/i.test(text) || (!DDP.test(text) && (source === 'REMUX' || source === 'BluRay')) ? 'TrueHD Atmos' : 'DD+ Atmos'
  return first(text, [
    [/true-?hd/i, 'TrueHD' as const],
    [/\bdts[-. ]?(hd|x|:x)/i, 'DTS-HD' as const],
    [DDP, 'DD+' as const],
    [/\b(dd|ac-?3|dd5\.1)\b/i, 'DD' as const],
    [/\baac\b/i, 'AAC' as const]
  ])
}

// Brazilian addons write "Dublado" / "DUAL" / "Dual Áudio" / "Legendado"; others list audio languages as flags.
// The English "Dual Audio" and "MULTi" (anime and European releases) say nothing about Portuguese on their own.
const PT = /🇧🇷|🇵🇹/u
const OTHER_FLAG = /(?!🇧🇷|🇵🇹)[\u{1F1E6}-\u{1F1FF}]{2}/u
const PT_WORD = /dublad|\bnacional\b|\bpt-?br\b|portugu[eê]s/i
function parseLang(text: string): Parsed['lang'] {
  const leg = /legendad|\bleg\b/i.test(text)
  const pt = PT.test(text) || PT_WORD.test(text)
  const englishDual = /dual[- .]?audio|\bmulti\b|multi[- .]?audio/i.test(text)
  if (
    /dual[- .]?áudio/i.test(text) ||
    (/\bdual\b/i.test(text) && !/dual[- .]?audio/i.test(text)) ||
    (englishDual && pt) ||
    (PT.test(text) && OTHER_FLAG.test(text)) ||
    (leg && /dublad/i.test(text))
  )
    return 'dual'
  // "Legendado PT-BR": the Portuguese is in the subtitles.
  if (leg) return 'leg'
  return pt ? 'dub' : null
}

// Wanted audio outweighs one resolution step: a 1080p dub beats even a 4K remux the household can't follow.
const LANG_FIT = 2500

function fitScore(p: Parsed, ctx: RankContext): number {
  let fit = 0
  if (ctx.audio === 'dub') fit += p.lang === 'dub' || p.lang === 'dual' ? LANG_FIT : p.lang === 'leg' ? -500 : 0
  if (ctx.audio === 'original' && p.lang === 'dub') fit -= LANG_FIT
  if (ctx.maxRes && p.res > ctx.maxRes) fit -= 5000
  return fit
}

const RES: Record<number, number> = { 2160: 4000, 1080: 3000, 720: 2000, 480: 1000, 0: 1500 }
// A remux is the disc untouched (40–100 Mbps, lossless audio), a cinema server's own bar; a web cópia is a re-encode at 15–25.
const SOURCE = { REMUX: 600, BluRay: 300, 'WEB-DL': 200, WEBRip: 100, HDTV: 0, CAM: -10000 }
const HDR = { DV: 300, 'HDR10+': 250, HDR: 200 }
// Lossless is the studio master; any lossy track, Atmos or not, is a compressed copy of it.
const AUDIO = { 'TrueHD Atmos': 300, TrueHD: 250, 'DTS-HD': 250, 'DD+ Atmos': 120, 'DD+': 80, DD: 40, AAC: 0 }
// 3D plays as two squashed pictures side by side; burned-in subtitles can't be turned off.
const FLAW = { '3D': -6000, hardsub: -800, upscale: -600 }

/** Picture + sound quality only, ignoring whether it can play right now. */
export function qualityScore(p: Parsed): number {
  return (
    RES[p.res] +
    (p.source ? SOURCE[p.source] : 0) +
    (p.hdr ? HDR[p.hdr] : 0) +
    (p.audio ? AUDIO[p.audio] : 0) +
    (p.flaw ? FLAW[p.flaw] : 0) +
    // Bigger file at the same tier = more bitrate = better picture: a 70 GB remux clearly outranks an 18 GB web cópia.
    Math.min(p.sizeGB ?? 0, 100) * 3
  )
}

const LOSSLESS_TRACK = /\b(truehd|mlp|flac|alac|pcm\w*)\b|dts[-. ]?hd[-. ]?(ma|master)|dts[-. :]?x\b/i
const RICH_TRACK = /\b(eac3|dts)\b/i
// Commentaries and audio description (narration of the picture) are never the film's sound.
const ASIDE = /comment|coment|descri/i

/**
 * The richest audio track in the language mpv picked: discs carry TrueHD Atmos or DTS-HD MA next to a lossy
 * AC-3 copy, and the file's default is not always the lossless one. Ties keep mpv's pick.
 */
export function bestAudio(tracks: Track[]): Track | undefined {
  const picked = tracks.find((t) => t.selected)
  if (!picked) return undefined
  const score = (t: Track) => {
    const s = `${t.codec ?? ''} ${t.title ?? ''}`
    return (LOSSLESS_TRACK.test(s) ? 200 : RICH_TRACK.test(s) ? 100 : 0) + (t.channels ?? 0)
  }
  return tracks
    .filter((t) => t.lang === picked.lang && !ASIDE.test(t.title ?? ''))
    .reduce((best, t) => (score(t) > score(best) ? t : best), picked)
}

// Many addons give no size. A typical web release bitrate stands in, so a 4K cópia doesn't promise "now" on a 10 Mbps link.
const TYPICAL_MBPS: Record<number, number> = { 2160: 18, 1080: 7, 720: 4, 480: 2, 0: 5 }

const PENALTY: Record<Verdict, number> = {
  instant: 0,
  tight: -300,
  download: -3000,
  // Even with a full swarm (+1000) a torrent stays one resolution step behind a direct link: it starts slower and stalls.
  p2p: -2500,
  uncached: -6000,
  unplayable: -20000,
  dead: -20000
}

export function rankStreams(streams: Stream[], ctx: RankContext = {}): Ranked[] {
  return streams
    .map((stream) => {
      const info = parseStream(stream)
      const quality = qualityScore(info)
      const fit = fitScore(info, ctx)
      const bitrateMbps =
        info.sizeGB && ctx.runtimeMin ? (info.sizeGB * 8000) / (ctx.runtimeMin * 60) : null
      const linkMbps = (stream.url && ctx.bandwidth?.[hostOf(stream.url)]) || undefined
      const needMbps = bitrateMbps ?? (linkMbps ? TYPICAL_MBPS[info.res] : null)

      let verdict: Verdict
      if (info.kind === 'other') verdict = 'unplayable'
      else if (stream.url && ctx.dead?.[stream.url]) verdict = 'dead'
      else if (info.cached === false) verdict = 'uncached'
      else if (info.kind === 'torrent') verdict = 'p2p'
      else if (!linkMbps || !needMbps) verdict = 'instant'
      else if (needMbps * 1.3 <= linkMbps) verdict = 'instant'
      else if (needMbps <= linkMbps) verdict = 'tight'
      else verdict = 'download'

      // A healthy swarm is close to a direct link; a dead one is nearly useless.
      const swarm = verdict === 'p2p' ? Math.min(info.seeders ?? 0, 100) * 10 : 0

      // Software-decoding 4K (AV1 on the VAIO's Vega) drops frames: prefer a codec the GPU handles.
      const softwareDecode =
        !!ctx.hwCodecs && info.res >= 2160 && !!info.codec && !ctx.hwCodecs.includes(info.codec)
      const decode = softwareDecode ? 1500 : 0

      // A download has time, but a dead swarm never finishes, and a healthy one is still slower than a direct link.
      const keep = quality + fit - decode + (verdict === 'p2p' ? swarm + PENALTY.p2p : 0)
      const rank = quality + fit + PENALTY[verdict] + swarm - decode
      return { stream, info, quality, fit, keep, rank, verdict, bitrateMbps, needMbps, linkMbps, softwareDecode }
    })
    // Ties: the debrid-cached one, then the healthier swarm.
    .sort((a, b) => b.rank - a.rank || Number(b.info.cached) - Number(a.info.cached) || (b.info.seeders ?? 0) - (a.info.seeders ?? 0))
}

/** "142 min" / "2h 22min" / "1h" → minutes. */
export function parseRuntime(runtime?: string): number | undefined {
  if (!runtime) return undefined
  const h = runtime.match(/(\d+)\s*h/i)
  const m = runtime.match(/(\d+)\s*m/i)
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
  return total || undefined
}
