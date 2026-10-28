import { useEffect, useRef, useState } from 'react'

// The poster is painted into a 48×27 canvas and the GPU upscales it to the whole room:
// a soft colour field for the cost of one tiny draw, no full-screen blur filter.
const W = 48
const H = 27

function paint(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'blur(2.5px) saturate(1.35)'
  // Cover-fit, biased to the upper half where posters keep faces and key art.
  const scale = Math.max(W / img.width, H / img.height) * 1.15
  const w = img.width * scale
  const h = img.height * scale
  ctx.drawImage(img, (W - w) / 2, (H - h) * 0.3, w, h)
}

/** Two canvases cross-fade so colour drifts from one title to the next instead of cutting. */
export function Ambilight({ src, intensity }: { src?: string; intensity: number }) {
  const a = useRef<HTMLCanvasElement>(null)
  const b = useRef<HTMLCanvasElement>(null)
  const [front, setFront] = useState<'a' | 'b'>('a')

  useEffect(() => {
    if (!src) return
    let alive = true
    // Rapid stick scrolling passes many posters: only paint where focus settles.
    const t = setTimeout(() => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        if (!alive) return
        const back = front === 'a' ? b.current : a.current
        if (!back) return
        paint(back, img)
        setFront((f) => (f === 'a' ? 'b' : 'a'))
      }
      img.src = src
    }, 140)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  return (
    <div className="ambilight" style={{ opacity: intensity }} aria-hidden>
      <canvas ref={a} width={W} height={H} style={{ opacity: front === 'a' ? 1 : 0 }} />
      <canvas ref={b} width={W} height={H} style={{ opacity: front === 'b' ? 1 : 0 }} />
    </div>
  )
}
