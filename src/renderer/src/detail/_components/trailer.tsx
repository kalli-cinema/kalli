import { motion } from 'motion/react'
import { useEffect, useState } from 'react'

const kalli = window.kalli

/** Long enough to read the page first; a trailer that starts at once feels like an ad. */
const DELAY = 3500

/**
 * A title's trailer, muted, behind its page. It fades in only once it truly plays (main's frame page says so, see
 * `src/main/trailer.ts`) and out when it ends; until then, or if YouTube refuses, the backdrop simply stays.
 */
export function Trailer({ ytId }: { ytId: string }) {
  const [src, setSrc] = useState<string>()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => void kalli.trailerUrl(ytId).then(setSrc), DELAY)
    return () => clearTimeout(t)
  }, [ytId])

  useEffect(() => {
    if (!src) return
    const origin = new URL(src).origin
    let gone: ReturnType<typeof setTimeout> | undefined
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return
      if (e.data === 'kalli-trailer:playing') setPlaying(true)
      if (e.data === 'kalli-trailer:ended') {
        setPlaying(false)
        // Once faded out, the frame goes: the backdrop stays for the rest of the visit.
        gone = setTimeout(() => setSrc(undefined), 1200)
      }
    }
    window.addEventListener('message', onMessage)
    return () => (window.removeEventListener('message', onMessage), clearTimeout(gone))
  }, [src])

  if (!src) return null
  return (
    <motion.iframe
      src={src}
      title="Trailer"
      aria-hidden
      tabIndex={-1}
      allow="autoplay"
      className="pointer-events-none absolute inset-0 size-full border-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: playing ? 1 : 0 }}
      transition={{ duration: playing ? 1.6 : 0.9, ease: [0.16, 1, 0.3, 1] }}
    />
  )
}
