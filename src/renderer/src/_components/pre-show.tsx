import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Meta, PlayRequest } from '../../../shared/types.ts'
import { getMeta, useLibrary, wallFilms } from '../data.ts'
import { useActions } from '../input.ts'
import { leave, settle, ty } from '../motion.ts'
import { Hint } from './hint.tsx'

const kalli = window.kalli

type Reel = { ytId: string; name: string }[]

/** A trailer that hasn't started by then is skipped; one that runs past the cap is cut. */
const STALL_MS = 8000
const CAP_MS = 150_000

/** Two trailers: films TMDB pairs with this one, else unwatched films off the wall. */
async function reelFor(req: PlayRequest, watched: Record<string, number>): Promise<Reel> {
  const { recs } = await kalli.after(req.metaId).catch(() => ({ recs: [] as Meta[] }))
  let films: (Meta | null)[] = recs
  if (!films.some((m) => m?.trailerStreams?.length)) {
    const pool = wallFilms().filter((m) => m.id !== req.metaId && !watched[m.id])
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, 5)
    films = await Promise.all(picks.map((m) => getMeta('movie', m.id)))
  }
  return films
    .filter((m): m is Meta => !!m?.trailerStreams?.[0]?.ytId)
    .slice(0, 2)
    .map((m) => ({ ytId: m.trailerStreams![0].ytId, name: m.name }))
}

/**
 * Pre-show: up to two trailers with sound before a film started from the beginning, while its link is warmed.
 * A goes straight to the film, B backs out. A reel that won't load, or a trailer that won't play, steps aside.
 */
export function PreShow({ req, onDone, onCancel }: { req: PlayRequest; onDone: () => void; onCancel: () => void }) {
  const watched = useLibrary().watched
  const [reel, setReel] = useState<Reel | null>(null)
  const [i, setI] = useState(0)
  const [src, setSrc] = useState<string>()
  const [playing, setPlaying] = useState(false)
  const done = useRef(false)
  const finish = () => !done.current && ((done.current = true), onDone())
  useActions((a) => (a === 'a' ? finish() : a === 'b' && onCancel()))

  useEffect(() => {
    let alive = true
    // Never more than a few seconds of waiting for a reel.
    const t = setTimeout(() => alive && setReel([]), 5000)
    void reelFor(req, watched).then((r) => alive && (clearTimeout(t), setReel(r)))
    if (!req.torrent) void kalli.warmPlay(req.url, req.headers).catch(() => {})
    return () => ((alive = false), clearTimeout(t))
  }, [])

  const cur = reel?.[i]
  useEffect(() => {
    if (reel && !cur) return void finish()
    if (!cur) return
    let alive = true
    setPlaying(false)
    setSrc(undefined)
    void kalli.trailerUrl(cur.ytId, true).then((u) => alive && (u ? setSrc(u) : setI((n) => n + 1)))
    return () => void (alive = false)
  }, [reel, cur?.ytId])

  useEffect(() => {
    if (!src) return
    const origin = new URL(src).origin
    const skip = () => setI((n) => n + 1)
    let cap = setTimeout(skip, STALL_MS)
    let started = false
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return
      if (e.data === 'kalli-trailer:playing' && !started) {
        started = true
        setPlaying(true)
        clearTimeout(cap)
        cap = setTimeout(skip, CAP_MS)
      }
      if (e.data === 'kalli-trailer:ended') skip()
    }
    window.addEventListener('message', onMessage)
    return () => (window.removeEventListener('message', onMessage), clearTimeout(cap))
  }, [src])

  return (
    <motion.div className="preshow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: leave }} transition={settle}>
      {src && (
        <motion.iframe
          key={src}
          src={src}
          title="Trailer"
          aria-hidden
          tabIndex={-1}
          allow="autoplay"
          className="pointer-events-none absolute inset-0 size-full border-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: playing ? 1 : 0 }}
          transition={{ duration: 1.2, ease: settle.ease }}
        />
      )}
      {!playing && (
        <motion.div className="preshow-card" initial={{ opacity: 0, transform: ty('0.75rem') }} animate={{ opacity: 1, transform: ty(0) }} transition={{ ...settle, delay: 0.2 }}>
          <p className="running-section">Pré-estreia</p>
          <h1 className="lights-title">{req.title}</h1>
        </motion.div>
      )}
      <p className="preshow-foot">
        <span className="preshow-next">
          {cur && playing ? `Trailer: ${cur.name} · ` : ''}A seguir: {req.title}
        </span>
        <Hint b="A">Começar o filme</Hint>
        <Hint b="B">Cancelar</Hint>
      </p>
    </motion.div>
  )
}
