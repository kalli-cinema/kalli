import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { MetaPreview } from '../../../shared/types.ts'
import { Hint } from '../_components/hint.tsx'
import { Keys } from '../_components/keys.tsx'
import { Poster } from '../_components/poster.tsx'
import { useWheelStep } from '../_hooks/use-wheel-step.ts'
import { useSearch } from '../data.ts'
import { pointerMoved, useActions, useInputMode } from '../input.ts'
import { LAYOUTS, moveKey, typeKey } from '../keyboard.ts'
import { leave, travel, ty } from '../motion.ts'

const KEYS = LAYOUTS.search
const COLS = 6
const COLS_WIDE = 9

type Focus = { zone: 'keys' | 'results'; r: number; c: number; i: number }

// Closing search and coming back keeps what was typed.
let lastQuery = ''

export function Search(p: { onClose: () => void; onOpen: (m: MetaPreview) => void; openId?: string; active: boolean }) {
  const [q, setQuery] = useState(lastQuery)
  const setQ = (next: string | ((s: string) => string)) =>
    setQuery((s) => (lastQuery = typeof next === 'function' ? next(s) : next))
  const [f, setF] = useState<Focus>({ zone: 'keys', r: 0, c: 0, i: 0 })
  const { results, searchable } = useSearch(q)
  const input = useRef<HTMLInputElement>(null)
  const n = results?.length ?? 0
  // The on-screen keyboard is for the pad. With a real keyboard you just type, and results get the whole width.
  const pad = useInputMode() === 'pad'
  const cols = pad ? COLS : COLS_WIDE
  // An entry opened on top owns the keyboard: stop typing into the hidden field.
  useEffect(() => void (p.active || input.current?.blur()), [p.active])

  // Type-to-search: a letter pressed while browsing results goes back into the field instead of firing a shortcut.
  useEffect(() => {
    if (!p.active) return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.key.length === 1 || e.key === 'Backspace'
      if (e.target === input.current || e.ctrlKey || e.altKey || e.metaKey || !typing) return
      e.stopPropagation()
      setF((f) => ({ ...f, zone: 'keys' }))
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [p.active])

  const type = (value: string) => setQ((s) => typeKey(s, value).replace(/^ +/, ''))
  const toResults = () => n && (input.current?.blur(), setF((f) => ({ ...f, zone: 'results', i: 0 })))
  const toField = () => (setF((f) => ({ ...f, zone: 'keys' })), pad || input.current?.focus())

  // Pad: B erases while there is text and leaves once it's empty, like every TV keyboard. Keyboard: Esc leaves.
  useActions((a) => {
    if (a === 'b') return pad && q ? type('back') : p.onClose()
    if (f.zone === 'keys') {
      if (!pad) return void (a === 'down' && toResults())
      if (a === 'x') return type(' ')
      const next = moveKey(KEYS, f, a)
      if (next && next !== f) setF({ ...f, ...next })
      if (!next && a === 'right') toResults()
      if (a === 'a') type(KEYS[f.r][f.c].value)
    } else {
      const col = f.i % cols
      if (a === 'left') col === 0 ? pad && toField() : setF({ ...f, i: f.i - 1 })
      if (a === 'right' && f.i + 1 < n && col < cols - 1) setF({ ...f, i: f.i + 1 })
      if (a === 'up') f.i >= cols ? setF({ ...f, i: f.i - cols }) : !pad && toField()
      if (a === 'down' && f.i + cols < n) setF({ ...f, i: f.i + cols })
      if (a === 'a' && results?.[f.i]) p.onOpen(results[f.i])
    }
  }, p.active)

  // One row of results per notch.
  const onWheel = useWheelStep((dir) => {
    if (!n) return
    setF({ ...f, zone: 'results', i: Math.max(0, Math.min(n - 1, (f.zone === 'results' ? f.i : 0) + dir * cols)) })
  })

  const focusedRow = Math.floor(f.i / cols)

  return (
    <motion.div
      className={`search ${pad ? '' : 'is-typing'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: leave }}
      transition={{ duration: 0.3 }}
      inert={!p.active}
      onWheel={onWheel}
    >
      <header className="running-head">
        <span className="running-section">Buscar</span>
        <span className="running-hints">
          {pad ? (
            <>
              <Hint b="A">Digitar</Hint>
              <Hint b="X">Espaço</Hint>
              <Hint b="B">{q ? 'Apagar' : 'Voltar'}</Hint>
            </>
          ) : (
            <>
              {f.zone === 'results' ? <Hint b="A">Abrir</Hint> : n > 0 && <Hint b="Down">Resultados</Hint>}
              <Hint b="B">Voltar</Hint>
            </>
          )}
        </span>
      </header>

      <label className="search-query">
        <input
          ref={input}
          data-nav
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setF((f) => ({ ...f, zone: 'keys' }))}
          onKeyDown={(e) => e.key === 'Enter' && toResults()}
          placeholder="Nome do filme ou série"
          spellCheck={false}
          aria-label="Buscar"
        />
      </label>

      {pad && (
        <Keys
          search
          rows={KEYS}
          pos={f.zone === 'keys' ? f : null}
          onPress={(pos) => (setF({ ...f, ...pos, zone: 'keys' }), type(KEYS[pos.r][pos.c].value))}
        />
      )}

      <section className="search-results" aria-label="Resultados">
        {/* One stable status line, so a screen reader hears each state once instead of every cover. */}
        <p className={`search-note ${n ? 'is-count' : ''}`} role="status">
          {!searchable
            ? 'Nenhuma fonte instalada aceita busca. Adicione uma em Perfil → Addons.'
            : q.trim().length < 2
              ? 'Digite pelo menos duas letras.'
              : results === null
                ? `Buscando “${q.trim()}”…`
                : !n
                  ? `Nada encontrado para “${q.trim()}”. Confira a grafia ou apague com B.`
                  : `${n} ${n === 1 ? 'resultado' : 'resultados'} para “${q.trim()}”`}
        </p>
        {n > 0 && (
          <motion.div className="search-grid" animate={{ transform: ty(`${-Math.max(0, focusedRow - 1) * 19.5}rem`) }} transition={travel}>
            {results!.map((m, i) => {
              const focused = f.zone === 'results' && f.i === i
              return (
                <Poster
                  key={m.id}
                  m={m}
                  className="in-grid"
                  focused={focused}
                  hidden={focused && p.openId === m.id}
                  onClick={() => p.onOpen(m)}
                  onHover={() => pointerMoved() && setF((f) => ({ ...f, zone: 'results', i }))}
                />
              )
            })}
          </motion.div>
        )}
      </section>

      <footer className="entry search-entry" aria-live="polite">
        {f.zone === 'results' && results?.[f.i] && (
          <div className="entry-main">
            <div className="entry-line">
              <h1 className="entry-title">{results[f.i].name}</h1>
            </div>
            <p className="entry-meta">{[results[f.i].releaseInfo, results[f.i].type === 'series' ? 'Série' : 'Filme'].filter(Boolean).join(' · ')}</p>
          </div>
        )}
      </footer>
    </motion.div>
  )
}
