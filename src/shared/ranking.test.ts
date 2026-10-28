import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestAudio, parseStream, rankStreams, parseRuntime } from './ranking.ts'
import type { Stream, Track } from './types.ts'

const remux: Stream = {
  name: '[RD+] Addon\n4k DV | HDR',
  title: 'Ondas.de.Areia.Parte.Dois.2024.2160p.UHD.BluRay.REMUX.DV.HDR.HEVC.TrueHD.Atmos.7.1\n👤 45 💾 74.2 GB',
  url: 'https://example/remux'
}
const web4k: Stream = {
  name: '[RD+] Addon\n4k HDR',
  title: 'Ondas.de.Areia.Parte.Dois.2024.2160p.WEB-DL.DDP5.1.Atmos.HDR.H.265\n👤 300 💾 18.1 GB',
  url: 'https://example/web4k'
}
const av1: Stream = {
  name: '[RD+] Addon\n4k HDR',
  title: 'Ondas.de.Areia.Parte.Dois.2024.2160p.WEB-DL.DDP5.1.Atmos.HDR.AV1\n👤 80 💾 12.4 GB',
  url: 'https://example/av1'
}
const uncached: Stream = {
  name: '[RD download] Addon\n4k DV',
  title: 'Ondas.de.Areia.Parte.Dois.2024.2160p.BluRay.REMUX.DV.TrueHD.Atmos\n💾 80.0 GB',
  url: 'https://example/uncached'
}
const cam: Stream = { name: 'Addon\n1080p', title: 'Ondas.de.Areia.2024.HDCAM.1080p.x264\n👤 900 💾 2 GB', url: 'https://example/cam' }
const p2p: Stream = { name: 'Addon\n1080p', title: 'Ondas.de.Areia.2024.1080p.BluRay.x264.DTS-HD.MA\n👤 120 💾 14 GB', infoHash: 'abc' }
const trailer: Stream = { name: 'Trailer', ytId: 'xyz' }

test('parses a cached remux', () => {
  assert.deepEqual(parseStream(remux), {
    res: 2160, hdr: 'DV', source: 'REMUX', codec: 'hevc', audio: 'TrueHD Atmos',
    sizeGB: 74.2, seeders: 45, cached: true, kind: 'http', lang: null, flaw: null
  })
  assert.equal(parseStream(uncached).cached, false)
  // Addon marks the debrid cache state with ⚡ / ⬇️
  assert.equal(parseStream({ name: '[RD⚡] Addon 2160p', url: 'https://example/c' }).cached, true)
  assert.equal(parseStream({ name: 'Addon 2160p', description: '⬇️ Not Cached\n💾 60 GB', url: 'https://example/c' }).cached, false)
  assert.equal(parseStream(cam).source, 'CAM')
  assert.equal(parseStream(p2p).audio, 'DTS-HD')
  assert.equal(parseStream({ behaviorHints: { videoSize: 5e9 } }).sizeGB, 5)
})

test('unknown bandwidth: best quality wins, uncached/cam/trailer sink', () => {
  const order = rankStreams([cam, trailer, uncached, web4k, p2p, remux], { runtimeMin: 166 }).map((r) => r.stream)
  assert.deepEqual(order.slice(0, 2), [remux, web4k])
  assert.equal(order.at(-1), trailer)
  assert.ok(order.indexOf(cam) > order.indexOf(p2p))
  assert.ok(order.indexOf(uncached) > order.indexOf(p2p))
})

test('slow link: remux becomes a download, the web 4K plays instantly', () => {
  // 74.2 GB over 166 min ≈ 59.6 Mbps; 18.1 GB ≈ 14.5 Mbps.
  const ranked = rankStreams([remux, web4k], { runtimeMin: 166, bandwidth: { example: 40 } })
  assert.equal(ranked[0].stream, web4k)
  assert.equal(ranked[0].verdict, 'instant')
  assert.equal(ranked[1].verdict, 'download')
  assert.ok(Math.abs(ranked[1].bitrateMbps! - 59.6) < 0.1)
  assert.equal(rankStreams([remux], { runtimeMin: 166, bandwidth: { example: 65 } })[0].verdict, 'tight')
})

test('bandwidth is per host: a slow server does not slow the others', () => {
  const fast = { ...remux, url: 'https://fast.cdn/remux' }
  const ranked = rankStreams([remux, fast], { runtimeMin: 166, bandwidth: { example: 20, 'fast.cdn': 200 } })
  assert.equal(ranked[0].stream, fast)
  assert.equal(ranked[0].linkMbps, 200)
  assert.equal(ranked[1].verdict, 'download')
})

test('unknown size: a 4K assumes a typical bitrate once the link is measured', () => {
  const nosize4k: Stream = { name: 'BestCine\n4K', title: 'Duna 2160p WEB-DL HDR', url: 'https://slow.host/4k' }
  const known1080: Stream = { name: 'BestCine', title: 'Duna 1080p WEB-DL 💾 3 GB', url: 'https://slow.host/1080' }
  const ranked = rankStreams([nosize4k, known1080], { runtimeMin: 166, bandwidth: { 'slow.host': 10 } })
  assert.equal(ranked[0].stream, known1080)
  assert.equal(ranked[1].verdict, 'download')
  assert.equal(ranked[1].bitrateMbps, null)
  // Not measured yet: nothing to compare against, so it still plays now.
  assert.equal(rankStreams([nosize4k])[0].verdict, 'instant')
})

const dub1080: Stream = { name: 'FenixFlix\n1080p', title: 'Duna Parte Dois (2024) 1080p WEB-DL Dublado', url: 'https://example/dub' }
const dual720: Stream = { name: 'BsCine', title: 'Duna.Parte.2.2024.720p.WEBRip.DUAL.5.1', url: 'https://example/dual' }
const leg4k: Stream = { name: 'King VOD\n4K', title: 'Duna Parte Dois 2160p WEB-DL Legendado PT-BR', url: 'https://example/leg' }
const flags: Stream = { name: 'Addon\n1080p', title: 'Ondas.de.Areia.2024.1080p.BluRay\n👤 50 💾 9 GB\n🇬🇧 / 🇧🇷', infoHash: 'def' }

test('audio language from Brazilian addons and flags', () => {
  assert.equal(parseStream(dub1080).lang, 'dub')
  assert.equal(parseStream(dual720).lang, 'dual')
  assert.equal(parseStream(leg4k).lang, 'leg')
  assert.equal(parseStream(flags).lang, 'dual')
  assert.equal(parseStream({ title: 'Duna Dublado e Legendado 1080p' }).lang, 'dual')
  assert.equal(parseStream(web4k).lang, null)
})

test('wanted audio outweighs one resolution step', () => {
  assert.equal(rankStreams([web4k, dub1080], { audio: 'dub' })[0].stream, dub1080)
  assert.equal(rankStreams([leg4k, dub1080], { audio: 'dub' })[0].stream, dub1080)
  // Original audio: a dub-only cópia sinks, the subtitled 4K wins.
  assert.equal(rankStreams([dub1080, leg4k], { audio: 'original' })[0].stream, leg4k)
  assert.equal(rankStreams([dub1080, leg4k])[0].stream, leg4k)
})

test('resolution cap: 1080p beats 4K when the profile caps at 1080p', () => {
  assert.equal(rankStreams([web4k, dub1080], { maxRes: 1080 })[0].stream, dub1080)
})

test('downloads prefer the healthy direct link over a torrent of the same quality', () => {
  const direct: Stream = { ...p2p, infoHash: undefined, url: 'https://example/direct' }
  const [a, b] = rankStreams([p2p, direct])
  assert.ok(rankStreams([direct])[0].keep > rankStreams([p2p])[0].keep)
  assert.equal(a.stream, direct)
  assert.equal(b.stream, p2p)
})

test('no AV1 hardware decode: 4K AV1 loses to 4K HEVC', () => {
  const ranked = rankStreams([av1, web4k], { hwCodecs: ['hevc', 'avc'] })
  assert.equal(ranked[0].stream, web4k)
  assert.equal(ranked[1].softwareDecode, true)
})

test('runtime parsing', () => {
  assert.equal(parseRuntime('166 min'), 166)
  assert.equal(parseRuntime('2h 46min'), 166)
  assert.equal(parseRuntime('1h'), 60)
  assert.equal(parseRuntime(''), undefined)
})

test('English "Dual Audio" and MULTi need a Portuguese sign to count as dubbed', () => {
  assert.equal(parseStream({ title: '[SubsPlease] Frieren - 05 (1080p) Dual Audio' }).lang, null)
  assert.equal(parseStream({ title: 'Ondas.de.Areia.2024.MULTi.1080p.BluRay' }).lang, null)
  assert.equal(parseStream({ title: 'Ondas.de.Areia.2024.MULTi.1080p.BluRay\n🇧🇷' }).lang, 'dual')
  assert.equal(parseStream({ title: 'Duna 2024 1080p Dual Áudio' }).lang, 'dual')
  assert.equal(parseStream({ title: 'Frieren 05 1080p English Dub' }).lang, null)
})

test('3D, burned-in subtitles and upscales sink below a clean cópia', () => {
  const sbs: Stream = { title: 'Avatar.2009.1080p.3D.HSBS.BluRay.x264 💾 12 GB', url: 'https://example/3d' }
  const clean: Stream = { title: 'Avatar.2009.720p.BluRay.x264 💾 4 GB', url: 'https://example/720' }
  assert.equal(parseStream(sbs).flaw, '3D')
  assert.equal(parseStream({ title: 'Movie.2024.1080p.WEBRip.HC.x264' }).flaw, 'hardsub')
  assert.equal(rankStreams([sbs, clean])[0].stream, clean)
})

test('streaming: a direct 1080p beats a 4K torrent; seeders read in other formats', () => {
  const torrent4k: Stream = { title: 'Ondas.de.Areia.2024.2160p.WEB-DL.HEVC\n👤 400 💾 20 GB', infoHash: 'x' }
  assert.equal(rankStreams([torrent4k, dub1080])[0].stream, dub1080)
  assert.equal(parseStream({ title: 'Ondas 1080p | Seeders: 37' }).seeders, 37)
  assert.equal(parseStream({ title: 'Ondas 1080p 👥 12' }).seeders, 12)
})

test('lossless Atmos only from a disc: a bare "Atmos" follows the source', () => {
  assert.equal(parseStream(web4k).audio, 'DD+ Atmos')
  assert.equal(parseStream({ title: 'Ondas.de.Areia.2024.2160p.WEB-DL.Atmos.HDR' }).audio, 'DD+ Atmos')
  assert.equal(parseStream({ title: 'Ondas.de.Areia.2024.2160p.BluRay.REMUX.Atmos' }).audio, 'TrueHD Atmos')
  assert.equal(parseStream({ title: 'Ondas.de.Areia.2024.2160p.BluRay.x265.DDP.Atmos' }).audio, 'DD+ Atmos')
})

test('a remux still wins on a link with little headroom; a dub profile still gets its dub', () => {
  const ranked = rankStreams([web4k, remux], { runtimeMin: 166, bandwidth: { example: 65 } })
  assert.equal(ranked[0].stream, remux)
  assert.equal(ranked[0].verdict, 'tight')
  assert.equal(rankStreams([remux, dub1080], { audio: 'dub' })[0].stream, dub1080)
})

test('the lossless track in the picked language beats the default lossy one; commentaries never win', () => {
  const t = (id: number, codec: string, channels: number, extra: Partial<Track> = {}): Track =>
    ({ id, lang: 'eng', codec, channels, selected: false, ...extra })
  const ac3 = t(1, 'ac3', 6, { selected: true })
  assert.equal(bestAudio([ac3, t(2, 'truehd', 8), t(3, 'ac3', 6, { lang: 'por' })])?.id, 2)
  assert.equal(bestAudio([ac3, t(2, 'dts', 6, { title: 'DTS-HD Master Audio 5.1' }), t(3, 'dts', 6)])?.id, 2)
  assert.equal(bestAudio([ac3, t(2, 'flac', 2, { title: "Director's Commentary" })])?.id, 1)
  assert.equal(bestAudio([ac3, t(2, 'ac3', 6)])?.id, 1)
})

test('a link that answered with an error is dead and never the pick', () => {
  const ranked = rankStreams([remux, web4k], { dead: { 'https://example/remux': true } })
  assert.equal(ranked[0].stream, web4k)
  assert.equal(ranked[1].verdict, 'dead')
})
