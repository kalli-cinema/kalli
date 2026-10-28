// The title page's background trailer: a YouTube embed inside a tiny page of our own on the local server. YouTube's
// player refuses pages without an http(s) origin (the packaged renderer is file://), and from here it can tell its
// parent the moment the video truly plays, so the page fades it in over the backdrop only then (never a spinner,
// an error panel or a play button).

const EMBED = 'https://www.youtube-nocookie.com'

/** YouTube video ids are 11 URL-safe characters; nothing else reaches the page. */
export const isTrailerId = (id: string) => /^[\w-]{11}$/.test(id)

/** `sound`: the pre-show's trailers play aloud; the title page's stay muted. */
export function trailerPage(id: string, origin: string, sound = false) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: sound ? '0' : '1',
    controls: '0',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3',
    disablekb: '1',
    fs: '0',
    enablejsapi: '1',
    origin
  })
  return `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
  /* Cover the frame and trim the edges where YouTube puts its marks. */
  iframe { position: absolute; top: 50%; left: 50%; width: max(100vw, 177.78vh); height: max(56.25vw, 100vh); border: 0;
    transform: translate(-50%, -50%) scale(1.12); pointer-events: none; }
</style>
<iframe id="v" allow="autoplay; encrypted-media" src="${EMBED}/embed/${id}?${params}"></iframe>
<script>
  const v = document.getElementById('v')
  let heard = false
  // The embed reports its state once a page says it listens; it only starts talking after loading, so keep saying it.
  const hello = setInterval(() => heard ? clearInterval(hello) : v.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '${EMBED}'), 400)
  setTimeout(() => clearInterval(hello), 15000)
  addEventListener('message', (e) => {
    if (e.origin !== '${EMBED}') return
    heard = true
    let m
    try { m = JSON.parse(e.data) } catch { return }
    const state = m.info && m.info.playerState
    if (state === 1) parent.postMessage('kalli-trailer:playing', '*')
    if (state === 0 || m.event === 'onError') parent.postMessage('kalli-trailer:ended', '*')
  })
</script>
`
}
