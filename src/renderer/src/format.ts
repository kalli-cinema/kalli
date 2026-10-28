import type { Parsed, Ranked } from '../../shared/ranking.ts'
import type { Download, Manifest, Meta, MetaPreview, Track, Video } from '../../shared/types.ts'

const RES: Record<number, string> = { 2160: '4K', 1080: '1080p', 720: '720p', 480: 'SD', 0: '' }
const HDR = { DV: 'Dolby Vision', 'HDR10+': 'HDR10+', HDR: 'HDR' }
const SOURCE = { REMUX: 'REMUX', BluRay: 'Blu-ray', 'WEB-DL': 'WEB-DL', WEBRip: 'WEBRip', HDTV: 'TV', CAM: 'gravada no cinema' }
const AUDIO = { 'TrueHD Atmos': 'Dolby TrueHD Atmos', 'DD+ Atmos': 'Dolby Atmos', TrueHD: 'Dolby TrueHD', 'DTS-HD': 'DTS-HD', 'DD+': 'Dolby Digital+', DD: 'Dolby Digital', AAC: 'AAC' }

const num = (n: number, digits = 1) => n.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })

export const gb = (bytes: number) => `${num(bytes / 1e9)} GB`

/** Download progress as "42%"; empty until the size is known. */
export const percent = (d: Download) => (d.size ? `${Math.floor((d.received / d.size) * 100)}%` : '')

/** "Baixando 42% · 2,1 GB de 5,0 GB · 4K · HDR" / "Pronto para ver · 4,8 GB · 1080p". */
export function downloadStatus(d: Download): string {
  const amount = d.size ? `${gb(d.received)} de ${gb(d.size)}` : gb(d.received)
  const state =
    d.state === 'done'
      ? `Pronto para ver · ${gb(d.size || d.received)}`
      : d.state === 'downloading'
        ? `Baixando ${percent(d) || ''} · ${amount}`
        : d.state === 'paused'
          ? `Pausado em ${percent(d) || '0%'} · ${amount}`
          : `Parou: ${d.error ?? 'erro'}`
  return [state.replace(/ {2,}/g, ' '), d.label].filter(Boolean).join(' · ')
}

/** IPC rejections arrive as "Error invoking remote method 'x': Error: why"; only "why" is for people. */
export const ipcError = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** "T1 E3 · Piloto" */
export const episodeLabel = (v: Video) => `T${v.season} E${v.episode}${v.title || v.name ? ` · ${v.title ?? v.name}` : ''}`

/** "2024 · 2h 46min · Ficção científica, Aventura · IMDb 8.5" */
export const facts = (m: MetaPreview, runtimeMin?: number) =>
  [m.releaseInfo, duration(runtimeMin), m.genres?.slice(0, 3).map(genre).join(', '), m.imdbRating && `IMDb ${m.imdbRating}`].filter(Boolean).join(' · ')

/** "Direção … · Elenco …", the first `cast` names. */
export const credits = (m: Partial<Meta>, cast: number) =>
  [m.director?.length && `Direção ${m.director.join(', ')}`, m.cast?.length && `Elenco ${m.cast.slice(0, cast).join(', ')}`].filter(Boolean).join(' · ')

const LANG = { dub: 'Dublado', dual: 'Dual áudio', leg: 'Legendado' }

/** "4K · Dolby Vision · REMUX · Dolby Atmos · Dual áudio" */
export function copyLabel(p: Parsed): string {
  return [RES[p.res], p.hdr && HDR[p.hdr], p.source && SOURCE[p.source], p.audio && AUDIO[p.audio], p.lang && LANG[p.lang]]
    .filter(Boolean)
    .join(' · ')
}

/** The speed is the one measured on this cópia's own server. */
export function verdictText(r: Ranked): string {
  const bandwidth = r.linkMbps
  const net = bandwidth ? `sua conexão: ${Math.round(bandwidth)} Mbps` : null
  const need = r.needMbps ? `precisa de ${r.bitrateMbps ? '' : 'cerca de '}${Math.round(r.needMbps)}` : null
  const sw = r.softwareDecode ? ' Sem decodificação por hardware nesta máquina.' : ''
  switch (r.verdict) {
    case 'instant':
      return (net && need ? `Começa agora. Sua conexão: ${Math.round(bandwidth!)} Mbps, ${need}.` : 'Começa agora.') + sw
    case 'tight':
      return `Começa agora, no limite da conexão (${net}, ${need}).` + sw
    case 'download':
      return `Pesada demais para assistir sem pausas (${net}, ${need}). Baixe e comece a ver durante o download.` + sw
    case 'p2p':
      return (
        `Torrent direto${r.info.seeders != null ? ` com ${r.info.seeders} fontes` : ''}: começa quando encontrar as fontes, e a velocidade depende delas.` + sw
      )
    case 'uncached':
      return 'A fonte ainda está preparando esta cópia; ela fica disponível quando terminar.'
    case 'dead':
      return 'O servidor respondeu com um erro em vez do vídeo. Esta cópia não abre: escolha outra.'
    case 'unplayable':
      return 'Não é um vídeo reproduzível.'
  }
}

/** Short tag for the cópias list. */
export const VERDICT_TAG: Record<Ranked['verdict'], string> = {
  instant: 'Agora',
  tight: 'No limite',
  download: 'Baixar antes',
  p2p: 'Torrent',
  uncached: 'Ainda não pronta',
  unplayable: 'Indisponível',
  dead: 'Link quebrado'
}

export function clock(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}

// mpv reports ISO 639-2 codes (OpenSubtitles adds `pob`); Intl names the 639-1 ones.
const ISO2: Record<string, string> = {
  pob: 'pt-BR', por: 'pt', eng: 'en', jpn: 'ja', spa: 'es', fre: 'fr', fra: 'fr', ger: 'de', deu: 'de', ita: 'it',
  kor: 'ko', chi: 'zh', zho: 'zh', rus: 'ru', ara: 'ar', hin: 'hi', pol: 'pl', tur: 'tr', dut: 'nl', nld: 'nl'
}
const LANG_NAME = new Intl.DisplayNames(['pt-BR'], { type: 'language' })

/** "Português (Brasil)", "Japonês"; empty for an unnamed track. */
export function languageName(code?: string): string {
  if (!code || code === 'und') return ''
  try {
    const name = LANG_NAME.of(ISO2[code] ?? code) ?? code
    return name.charAt(0).toLocaleUpperCase('pt-BR') + name.slice(1)
  } catch {
    return code
  }
}

const CHANNELS: Record<number, string> = { 1: 'Mono', 2: 'Estéreo', 6: '5.1', 8: '7.1' }

/** An audio or subtitle track as people read it: "Inglês · 5.1 · Commentary" / "Português (Brasil) · Online". */
export function trackLabel(t: Track, n: number): string {
  const parts = [
    languageName(t.lang),
    t.channels ? (CHANNELS[t.channels] ?? `${t.channels} canais`) : '',
    t.title && !/^online \d+$/i.test(t.title) ? t.title : '',
    t.external ? 'Online' : ''
  ].filter(Boolean)
  return parts.length ? [...new Set(parts)].join(' · ') : `Faixa ${n}`
}

/** "Termina às 22:41": when the video ends if it plays on from here. */
export const endsAt = (secsLeft: number) =>
  `Termina às ${new Date(Date.now() + secsLeft * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`

/** "Faltam 42 min" / "Faltam 1h 05min" / "Falta 1 min": time left, the way people say it. */
export function minutesLeft(secs: number): string {
  const min = Math.max(1, Math.round(secs / 60))
  return min === 1 ? 'Falta 1 min' : `Faltam ${min < 60 ? `${min} min` : duration(min)}`
}

export function duration(min?: number): string | undefined {
  if (!min) return undefined
  const h = Math.floor(min / 60)
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}min` : `${min}min`
}

const GENRES: Record<string, string> = {
  Action: 'Ação', Adventure: 'Aventura', Animation: 'Animação', Biography: 'Biografia', Comedy: 'Comédia',
  Crime: 'Crime', Documentary: 'Documentário', Drama: 'Drama', Family: 'Família', Fantasy: 'Fantasia',
  History: 'História', Horror: 'Terror', Music: 'Música', Musical: 'Musical', Mystery: 'Mistério',
  Romance: 'Romance', 'Sci-Fi': 'Ficção científica', Sport: 'Esporte', Thriller: 'Suspense', War: 'Guerra',
  Western: 'Faroeste', 'Reality-TV': 'Reality', 'Talk-Show': 'Talk show', 'Game-Show': 'Game show', News: 'Notícias'
}
export const genre = (g: string) => GENRES[g] ?? g

const CATALOG: Record<string, string> = { Popular: 'Populares', Featured: 'Destaques', New: 'Novidades', Top: 'Mais vistos' }
const TYPE: Record<string, string> = { movie: 'Filmes', series: 'Séries', channel: 'Canais', tv: 'TV', anime: 'Anime' }
const RESOURCE: Record<string, string> = { catalog: 'seções', meta: 'detalhes', stream: 'cópias', subtitles: 'legendas' }

/** "a, b e c" */
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}` : (xs[0] ?? ''))

/** What an addon brings: "Filmes e Séries · Traz cópias e legendas · v1.4.0" */
export function addonFacts(m: Manifest): string {
  const types = [...new Set(m.types.map((t) => TYPE[t]).filter(Boolean))]
  const brings = [...new Set(m.resources.map((r) => RESOURCE[typeof r === 'string' ? r : r.name]).filter(Boolean))]
  return [list(types), brings.length && `Traz ${list(brings)}`, `v${m.version}`].filter(Boolean).join(' · ')
}
export const sectionName = (type: string, name?: string) =>
  `${TYPE[type] ?? type} · ${name ? (CATALOG[name] ?? name) : ''}`.replace(/ · $/, '')
