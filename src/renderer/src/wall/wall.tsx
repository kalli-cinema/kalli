import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import type { MetaPreview } from '../../../shared/types.ts'
import { Hint } from '../_components/hint.tsx'
import { Poster } from '../_components/poster.tsx'
import { useWheelStep } from '../_hooks/use-wheel-step.ts'
import { prefetchStreams } from '../_hooks/use-streams.ts'
import { forget, railItems, sized, useCatalog, useLibrary, useMeta, type Library, type RailItem, type Section } from '../data.ts'
import { pointerMoved, useActions } from '../input.ts'
import { travel, tx, ty } from '../motion.ts'
import { usePrefs } from '../prefs.ts'
import { Ambilight } from './_components/ambilight.tsx'
import { Entry } from './_components/entry.tsx'
import { RailTile } from './_components/rail-tile.tsx'
import { GAP, PAD, RAIL_H, ROWS, TOP, useGeometry } from './_hooks/use-geometry.ts'

const DWELL_MS = 1100

/** The episode a series' page will open on, when the library already knows it: the one in progress, else the next. */
const episodeOf = (lib: Library, metaId: string) =>
  Object.values(lib.progress)
    .filter((p) => p.metaId === metaId && p.key !== metaId)
    .sort((a, b) => b.at - a.at)[0]?.key ?? lib.upNext[metaId]?.key

type Focus = { zone: 'rail' | 'wall'; rail: number; col: number; row: number }

type WallProps = {
  sections: Section[]
  section: number
  onSection: (i: number) => void
  openId?: string
  onOpen: (m: MetaPreview) => void
  onResume: (item: RailItem) => void
  onOpenRail: (item: RailItem) => void
  onToggleDownload: (item: RailItem) => void
  onProfile: () => void
  onSearch: () => void
  /** Keyboard or mouse in Big Picture: Esc (or the hint) goes back to a window. */
  onLeaveFullscreen?: () => void
  active: boolean
}

export function Wall(p: WallProps) {
  const g = useGeometry()
  const lib = useLibrary()
  const rail = useMemo(() => railItems(lib), [lib])
  const sec = p.sections[p.section]
  const { items, failed, retry } = useCatalog(sec)
  const n = items?.length ?? 0
  const nCols = Math.max(1, Math.ceil(n / ROWS))

  const [focus, setFocus] = useState<Focus>({ zone: 'rail', rail: 0, col: 0, row: 0 })
  const [cam, setCam] = useState(0)
  const [span, setSpan] = useState<[number, number]>([-2, 16])
  const zone = focus.zone === 'rail' && rail.length ? 'rail' : 'wall'

  // Wrap a virtual (unbounded) column onto the catalogue: the wall has no left or right end.
  const at = (col: number, row: number) => {
    const c = ((col % nCols) + nCols) % nCols
    const i = c * ROWS + row
    return i < n ? i : -1
  }

  const moveCam = (col: number) => {
    // Edge-following: focus glides freely in the middle; the wall only travels near the edges.
    let next = cam
    if (col < cam + 1) next = col - 1
    if (col > cam + g.fullCols - 2) next = col - g.fullCols + 2
    if (next !== cam) {
      setSpan([Math.min(cam, next) - 2, Math.max(cam, next) + g.fullCols + 3])
      setCam(next)
    }
  }

  const moveWall = (col: number, row: number) => {
    if (!n) return
    row = Math.max(0, Math.min(ROWS - 1, row))
    while (row > 0 && at(col, row) < 0) row--
    moveCam(col)
    setFocus((f) => ({ ...f, zone: 'wall', col, row }))
  }

  // Reset to the start of the catalogue when the section changes.
  useEffect(() => {
    setCam(-1)
    setSpan([-3, g.fullCols + 3])
    setFocus((f) => ({ ...f, col: 0, row: 0 }))
  }, [p.section])

  const railIdx = Math.min(focus.rail, rail.length - 1)
  const focusedItem = zone === 'wall' && items ? items[at(focus.col, focus.row)] : undefined
  const focusedRail = zone === 'rail' ? rail[railIdx] : undefined

  // Dwell: resting on a title for a moment opens its entry in place and lets its colour fill the room.
  // Its meta (PT-BR title and synopsis with TMDB) loads as soon as focus settles, ahead of the dwell.
  const focusKey = zone === 'wall' ? focusedItem?.id : focusedRail?.key
  const [dwell, setDwell] = useState(false)
  const [settled, setSettled] = useState<string>()
  useEffect(() => {
    setDwell(false)
    const s = setTimeout(() => setSettled(focusKey), 250)
    const t = setTimeout(() => setDwell(true), DWELL_MS)
    return () => (clearTimeout(s), clearTimeout(t))
  }, [focusKey])
  const meta = useMeta(focusedItem?.type ?? '', settled === focusedItem?.id ? settled : undefined)
  // A Continuar tile at rest: its link is followed to where it serves from ahead of the press, so A starts at once.
  useEffect(() => {
    const req = focusedRail && settled === focusedRail.key ? focusedRail.progress : undefined
    if (req && !req.torrent) void window.kalli.warmPlay(req.url, req.headers).catch(() => {})
  }, [settled])
  // A cover at rest (~700 ms): its cópias are fetched and the pick checked, so its page opens with Assistir ready.
  // A series only when the library knows its episode (the one in progress, or the next one).
  const prefs = usePrefs()
  useEffect(() => {
    const m = focusedItem && settled === focusedItem.id ? focusedItem : undefined
    const video = m?.type === 'movie' ? m.id : m && episodeOf(lib, m.id)
    if (!m || !video || !prefs) return
    const t = setTimeout(() => prefetchStreams(m.type, video, prefs), 450)
    return () => clearTimeout(t)
  }, [settled])

  useActions((a) => {
    if (zone === 'rail') {
      const item = rail[railIdx]
      if (a === 'left') setFocus((f) => ({ ...f, rail: Math.max(0, railIdx - 1) }))
      if (a === 'right') setFocus((f) => ({ ...f, rail: Math.min(rail.length - 1, railIdx + 1) }))
      if (a === 'down') moveWall(focus.col, 0)
      if (a === 'a' && item) p.onResume(item)
      if (a === 'y' && item) p.onOpenRail(item)
      // X pauses or resumes a download; on anything else it takes the title out of Continuar.
      if (a === 'x' && item) item.download && item.download.state !== 'done' ? p.onToggleDownload(item) : void forget(item.metaId)
    } else {
      if (a === 'left') moveWall(focus.col - 1, focus.row)
      if (a === 'right') moveWall(focus.col + 1, focus.row)
      if (a === 'up') focus.row === 0 ? rail.length && setFocus((f) => ({ ...f, zone: 'rail' })) : moveWall(focus.col, focus.row - 1)
      if (a === 'down') moveWall(focus.col, focus.row + 1)
      if (a === 'lt') moveWall(focus.col - g.fullCols + 1, focus.row)
      if (a === 'rt') moveWall(focus.col + g.fullCols - 1, focus.row)
      if (a === 'a') focusedItem ? p.onOpen(focusedItem) : failed && retry()
      // Y is "more" everywhere: here it opens the entry in place without waiting for the dwell.
      if (a === 'y' && focusedItem) setDwell(true)
    }
    const count = p.sections.length
    if (count && a === 'lb') p.onSection((p.section - 1 + count) % count)
    if (count && a === 'rb') p.onSection((p.section + 1) % count)
    if (a === 'start') p.onProfile()
    if (a === 'back') p.onSearch()
    if (a === 'b') p.onLeaveFullscreen?.()
  }, p.active)

  // One column per notch; over the rail it moves the rail.
  const onWheel = useWheelStep((dir) => {
    if (zone === 'rail') setFocus((f) => ({ ...f, rail: Math.max(0, Math.min(rail.length - 1, railIdx + dir)) }))
    else moveWall(focus.col + dir, focus.row)
  })

  const cols = Array.from({ length: span[1] - span[0] + 1 }, (_, i) => span[0] + i)

  const glow = zone === 'rail' ? sized(focusedRail?.background, 'small') : focusedItem?.poster

  return (
    <div className={`home ${dwell ? 'is-dwelling' : ''}`} inert={!p.active} onWheel={onWheel}>
      <Ambilight src={glow} intensity={dwell ? 0.9 : 0.5} />
      <div className="room-scrim" aria-hidden />

      <header className="running-head">
        <span className="running-section">{zone === 'rail' ? 'Continuar' : (sec?.name ?? 'Programa')}</span>
        {/* Up here: moving around. What the focused title does sits on the baseline, where the eye already is. */}
        <span className="running-hints">
          <Hint b={['LB', 'RB']}>Seção</Hint>
          <Hint b={['LT', 'RT']}>Página</Hint>
          <Hint b="View">Buscar</Hint>
          <Hint b="Menu">Perfil</Hint>
          {p.onLeaveFullscreen && <Hint b="B">Sair da tela cheia</Hint>}
        </span>
      </header>

      <AnimatePresence>
        {zone === 'rail' && (
          <motion.section
            className="rail"
            style={{ top: `${TOP}rem` }}
            initial={{ opacity: 0, transform: ty('-2rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transform: ty('-2rem') }}
            transition={travel}
            aria-label="Continuar"
          >
            <motion.div className="rail-track" animate={{ transform: tx(`${-Math.max(0, railIdx - 3) * 19.25}rem`) }} transition={travel}>
              {rail.map((item, i) => (
                <RailTile
                  key={item.key}
                  item={item}
                  focused={i === railIdx}
                  onClick={() => p.onResume(item)}
                  onHover={() => pointerMoved() && setFocus((f) => ({ ...f, zone: 'rail', rail: i }))}
                />
              ))}
            </motion.div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div
        className="wall"
        style={{ top: `${TOP}rem`, height: `${ROWS * g.rowH + (ROWS - 1) * GAP}rem` }}
        animate={{ transform: ty(zone === 'rail' ? `${RAIL_H}rem` : 0) }}
        transition={travel}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={sec?.key}
            className="wall-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transform: tx(-cam * g.colW * g.rem) }}
            exit={{ opacity: 0 }}
            transition={{ transform: travel, opacity: { duration: 0.35 } }}
            onAnimationComplete={() => setSpan([cam - 2, cam + g.fullCols + 3])}
          >
            {cols.map((c) =>
              Array.from({ length: ROWS }, (_, r) => {
                const m = items?.[at(c, r)]
                if (items && !m) return null
                const focused = zone === 'wall' && c === focus.col && r === focus.row
                return (
                  <Poster
                    key={`${c}:${r}`}
                    m={m}
                    style={{ left: `${PAD + c * g.colW}rem`, top: `${r * (g.rowH + GAP)}rem`, width: `${g.posterW}rem` }}
                    focused={focused}
                    hidden={focused && p.openId === m?.id}
                    onClick={() => (moveWall(c, r), m && p.onOpen(m))}
                    // Hover focuses (and so dwells) without dragging the wall around under the pointer.
                    onHover={() => pointerMoved() && setFocus((f) => ({ ...f, zone: 'wall', col: c, row: r }))}
                  />
                )
              })
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      <Entry
        item={focusedItem}
        rail={focusedRail}
        meta={meta ?? undefined}
        number={zone === 'wall' && focusedItem ? at(focus.col, focus.row) + 1 : undefined}
        dwell={dwell}
        loading={!items}
        empty={items?.length === 0}
        failed={failed}
        noSources={!p.sections.length}
        section={sec?.name}
        // Shown on the top row only, where ↑ (or a click on the hint) really opens Continuar.
        hasRail={rail.length > 0 && focus.row === 0}
      />
    </div>
  )
}
