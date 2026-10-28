import { Check } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import type { SoundMode, Track } from '../../../../shared/types.ts'
import { Hint } from '../../_components/hint.tsx'
import { Scrim } from '../../_components/scrim.tsx'
import { trackLabel } from '../../format.ts'
import { useActions } from '../../input.ts'
import { leave, settle, tx } from '../../motion.ts'
import { cn } from '../../lib/utils.ts'

type TracksPanelProps = {
  audio: Track[]
  subs: Track[]
  /** The sound mode in use; undefined while bitstreaming to a receiver (no Som column then). */
  sound?: SoundMode
  onAudio: (id: number) => void
  /** 0 turns subtitles off. */
  onSub: (id: number) => void
  onSound: (mode: SoundMode) => void
  onClose: () => void
}

type Option = { key: string; label: string; on: boolean; pick: () => void }

const SOUNDS: [SoundMode, string][] = [
  ['original', 'Original'],
  ['dialogue', 'Diálogos claros'],
  ['night', 'Noturno']
]

/**
 * Áudio, Legendas and Som side by side. A picks at once (a track is remembered for the rest of the series, the
 * sound for this computer); B closes.
 */
export function TracksPanel({ audio, subs, sound, onAudio, onSub, onSound, onClose }: TracksPanelProps) {
  const cols: { title: string; options: Option[]; empty?: string }[] = [
    {
      title: 'Áudio',
      options: audio.map((t, i) => ({ key: `a${t.id}`, label: trackLabel(t, i + 1), on: t.selected, pick: () => onAudio(t.id) })),
      empty: 'Sem faixas de áudio'
    },
    {
      title: 'Legendas',
      options: [
        { key: 's0', label: 'Desligadas', on: !subs.some((s) => s.selected), pick: () => onSub(0) },
        ...subs.map((t, i) => ({ key: `s${t.id}`, label: trackLabel(t, i + 1), on: t.selected, pick: () => onSub(t.id) }))
      ]
    },
    ...(sound ? [{ title: 'Som', options: SOUNDS.map(([mode, label]) => ({ key: mode, label, on: sound === mode, pick: () => onSound(mode) })) }] : [])
  ]
  const [col, setCol] = useState(audio.length > 1 || !subs.length ? 0 : 1)
  const [rows, setRows] = useState(() => cols.map((c) => Math.max(0, c.options.findIndex((o) => o.on))))
  const row = Math.min(rows[col], cols[col].options.length - 1)
  const move = (c: number, r: number) => {
    setCol(c)
    setRows((rs) => rs.map((x, i) => (i === c ? Math.max(0, Math.min(cols[c].options.length - 1, r)) : x)))
  }
  // Left/Right skips a column with nothing in it (no audio tracks).
  const step = (dir: 1 | -1) => {
    for (let c = col + dir; c >= 0 && c < cols.length; c += dir) if (cols[c].options.length) return setCol(c)
  }

  useActions((a) => {
    if (a === 'b' || a === 'y') onClose()
    if (a === 'up') move(col, row - 1)
    if (a === 'down') move(col, row + 1)
    if (a === 'left') step(-1)
    if (a === 'right') step(1)
    if (a === 'a') cols[col].options[row]?.pick()
  })

  return (
    <>
    <Scrim onClose={onClose} />
    <motion.aside
      className={cn('player-panel is-tracks', cols.length === 3 && 'w-[74rem]')}
      initial={{ opacity: 0, transform: tx('3rem') }}
      animate={{ opacity: 1, transform: tx(0) }}
      exit={{ opacity: 0, transform: tx('2rem'), transition: leave }}
      transition={settle}
      aria-label={sound ? 'Áudio, legendas e som' : 'Áudio e legendas'}
    >
      <div className={cn('panel-columns', cols.length === 3 && 'grid-cols-3')}>
        {cols.map(({ title, options, empty }, c) => (
          <section key={title} className="panel-column">
            <h2 className="panel-heading">{title}</h2>
            <ul role="listbox" aria-label={title}>
              {options.map((o, i) => (
                <li key={o.key} role="option" aria-selected={o.on}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={cn('panel-option', c === col && i === row && 'is-focused', o.on && 'is-on')}
                    onClick={() => (move(c, i), o.pick())}
                    onMouseEnter={() => move(c, i)}
                  >
                    <Check className="panel-check" aria-hidden />
                    <span>{o.label}</span>
                  </button>
                </li>
              ))}
              {!options.length && empty && <li className="panel-empty">{empty}</li>}
            </ul>
          </section>
        ))}
      </div>
      <p className="panel-hints">
        <Hint b="A">Escolher</Hint>
        <Hint b="B">Fechar</Hint>
      </p>
    </motion.aside>
    </>
  )
}
