import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { Ranked } from '../../../../shared/ranking.ts'
import { Hint } from '../../_components/hint.tsx'
import { Scrim } from '../../_components/scrim.tsx'
import { copyLabel, verdictText } from '../../format.ts'
import { pointerMoved, useActions } from '../../input.ts'
import { travel, tx } from '../../motion.ts'
import { downloadable, playable } from '../../streams.ts'
import { CopyRow } from './copy-row.tsx'

type CopiesProps = { ranked: Ranked[]; bandwidth?: number; onClose: () => void; onPlay: (r: Ranked) => void; onDownload: (r: Ranked) => void }

/**
 * Ver cópias: every cópia, best first, each with what it would do on this connection. The list scrolls natively:
 * the D-pad brings the focused row into view, the wheel scrolls it, and hovering never moves it.
 */
export function Copies(p: CopiesProps) {
  const [i, setI] = useState(0)
  const list = useRef<HTMLOListElement>(null)
  // Only a D-pad or key move scrolls; a hovered row is already where the pointer is.
  const byPointer = useRef(false)
  const move = (j: number) => {
    byPointer.current = false
    setI(Math.max(0, Math.min(p.ranked.length - 1, j)))
  }
  useEffect(() => {
    if (!byPointer.current) list.current?.children[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [i])
  useActions((a) => {
    if (a === 'up') move(i - 1)
    if (a === 'down') move(i + 1)
    if (a === 'lt') move(i - 6)
    if (a === 'rt') move(i + 6)
    if (a === 'a' && playable(p.ranked[i])) p.onPlay(p.ranked[i])
    if (a === 'x' && downloadable(p.ranked[i])) p.onDownload(p.ranked[i])
    if (a === 'b') p.onClose()
  })
  const r = p.ranked[i]
  return (
    <>
    <Scrim onClose={p.onClose} />
    <motion.aside
      className="sheet copies"
      initial={{ transform: tx('100%') }}
      animate={{ transform: tx(0) }}
      exit={{ transform: tx('100%') }}
      transition={travel}
      aria-label="Outras cópias"
    >
      <h2 className="sheet-title">Cópias</h2>
      <p className="sheet-sub">
        {p.ranked.length} encontradas{p.bandwidth ? ` · sua conexão: ${Math.round(p.bandwidth)} Mbps` : ''}
      </p>
      <ol ref={list} className="copies-list">
        {p.ranked.map((c, j) => (
          <CopyRow
            key={c.stream.url ?? `${c.stream.infoHash}:${c.stream.fileIdx ?? ''}:${j}`}
            c={c}
            focused={j === i}
            onHover={() => pointerMoved() && ((byPointer.current = true), setI(j))}
            onClick={() => playable(c) && p.onPlay(c)}
          />
        ))}
      </ol>
      <p className="copies-verdict" aria-live="polite">
        {copyLabel(r.info) ? `${copyLabel(r.info)}. ` : ''}
        {verdictText(r)}
      </p>
      <span className="sheet-hints">
        {playable(r) && <Hint b="A">Assistir</Hint>}
        {downloadable(r) && <Hint b="X">Baixar</Hint>}
        <Hint b={['LT', 'RT']}>Página</Hint>
        <Hint b="B">Fechar</Hint>
      </span>
    </motion.aside>
    </>
  )
}
