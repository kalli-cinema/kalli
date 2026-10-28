import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Addon, BtDevice, Controllers, LightRoom, UpdateStatus } from '../../../shared/types.ts'
import { useLibrary, usePlayerStatus } from '../data.ts'
import { ipcError } from '../format.ts'
import { pointerMoved, press, useActions, useInputMode } from '../input.ts'
import { LAYOUTS, moveKey, typeKey, type Pos } from '../keyboard.ts'
import { leave, settle, ty } from '../motion.ts'
import { usePrefs } from '../prefs.ts'
import { FieldEditor } from '../_components/field-editor.tsx'
import { AddonPreview } from './_components/addon-preview.tsx'
import { MenuHints } from './_components/menu-hints.tsx'
import { MenuNav } from './_components/menu-nav.tsx'
import { MenuRow } from './_components/menu-row.tsx'
import { SECTIONS, type Editor, type Row, type TextRow } from './rows.ts'

const kalli = window.kalli

const keysFor = (ed: Editor) => LAYOUTS[ed.row.keys === 'url' ? 'url' : 'search']
// Names capitalize each word by themselves; URLs and keys keep the shift key.
const upperFor = (ed: Editor) => (ed.row.keys === 'name' ? /(^|\s)$/.test(ed.draft) : ed.upper)

/**
 * Perfil: a full-screen, game-style menu. Sections on the left, their options on the right, every one of them
 * reachable with the pad: Up/Down moves, A opens or acts, Left/Right chooses, LB/RB jumps a section, B goes back.
 */
export function ProfileMenu({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs()!
  const player = usePlayerStatus()
  const [addons, setAddons] = useState<Addon[]>([])
  useEffect(() => void kalli.addons().then(setAddons), [])

  const [sec, setSec] = useState(0)
  const [inPane, setInPane] = useState(false)
  const [i, setI] = useState(0)
  const [editor, setEditor] = useState<Editor | null>(null)
  const [preview, setPreview] = useState<Addon | null>(null)
  // Removing (a profile, an addon) is destructive: it takes a second A.
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; text: string } | null>(null)
  // The on-screen keyboard only appears for the pad; a real keyboard types straight into the field.
  const pad = useInputMode() === 'pad'

  const section = SECTIONS[sec]
  const lib = useLibrary()
  const downloads = useMemo(() => Object.values(lib.downloads), [lib.downloads])
  // Controllers: loaded on open, again whenever one connects, disconnects or pairs.
  const [controllers, setControllers] = useState<Controllers | null>(null)
  const [found, setFound] = useState<BtDevice[] | null>(null)
  useEffect(() => {
    const load = () => void kalli.controllers().then(setControllers).catch(() => {})
    load()
    return kalli.onNotify((n) => n.kind === 'gamepad' && load())
  }, [])
  // Hue rooms: read from the paired bridge on open, replaced by a new pairing.
  const [rooms, setRooms] = useState<LightRoom[]>([])
  useEffect(() => void kalli.lightRooms().then(setRooms), [])
  // Kalli's own update: read on open, again when main says one is ready.
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  useEffect(() => {
    const load = () => void kalli.update().then(setUpdate, () => {})
    load()
    return kalli.onNotify((n) => n.kind === 'update' && load())
  }, [])
  const rows = section.rows({
    prefs,
    addons,
    player,
    update,
    downloads,
    controllers,
    found,
    rooms,
    setControllers,
    setFound,
    setRooms,
    setAddons,
    preview: setPreview
  })
  const at = Math.min(i, rows.length - 1)
  const row = rows[at]

  // Rows differ in height (notes, groups, errors): let the browser bring the focused one into view.
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    setConfirming(null)
    setError(null)
    list.current?.children[at]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [at, sec])

  const go = (s: number) => {
    setSec((s + SECTIONS.length) % SECTIONS.length)
    setI(0)
  }

  /** A row's async work, with its busy state and its error line. */
  const attempt = async (id: string, work: () => unknown) => {
    setBusy(id)
    setError(null)
    try {
      await work()
      return true
    } catch (e) {
      setError({ id, text: ipcError(e) })
      return false
    } finally {
      setBusy(null)
    }
  }

  const pick = (r: Row, k: number) => {
    if (r.kind !== 'choice' || k < 0 || k >= r.options.length || k === r.at) return
    Promise.resolve(r.pick(k)).catch((e) => setError({ id: r.id, text: ipcError(e) }))
  }

  const edit = (r: TextRow) => setEditor({ row: r, draft: r.value, pos: { r: r.keys === 'url' ? 1 : 0, c: 0 }, upper: false })
  const closeEditor = () => (setEditor(null), setError(null))
  const save = async (ed: Editor) => {
    if (await attempt(ed.row.id, () => ed.row.save(ed.draft))) setEditor(null)
  }
  const type = async (ed: Editor, pos: Pos) => {
    const value = keysFor(ed)[pos.r][pos.c].value
    if (value === 'shift') return setEditor({ ...ed, pos, upper: !ed.upper })
    if (value === 'done') return void save(ed)
    if (value === 'paste') return setEditor({ ...ed, pos, draft: ed.draft + (await kalli.readClipboard()) })
    setEditor({ ...ed, pos, draft: typeKey(ed.draft, value, upperFor(ed)) })
  }

  const installed = (a: Addon) => addons.some((x) => x.manifest.id === a.manifest.id)
  const install = (a: Addon) => attempt('preview', async () => (setAddons(await kalli.installAddon(a.transportUrl)), setPreview(null)))

  useActions((a) => {
    if (busy) return
    if (preview) {
      if (a === 'a') void install(preview)
      if (a === 'b') (setPreview(null), setError(null))
      return
    }
    if (editor && !pad) {
      // A real keyboard types into the field; Enter/A saves, Esc/B cancels.
      if (a === 'a' || a === 'start') void save(editor)
      if (a === 'b') closeEditor()
      return
    }
    if (editor) {
      const next = moveKey(keysFor(editor), editor.pos, a)
      if (next && next !== editor.pos) setEditor({ ...editor, pos: next })
      if (a === 'a') void type(editor, editor.pos)
      if (a === 'y' && editor.row.keys === 'url') setEditor({ ...editor, upper: !editor.upper })
      if (a === 'start') void save(editor)
      if (a === 'b') editor.draft ? setEditor({ ...editor, draft: editor.draft.slice(0, -1) }) : closeEditor()
      return
    }
    if (a === 'lb') go(sec - 1)
    if (a === 'rb') go(sec + 1)
    if (a === 'start') onClose()
    if (!inPane) {
      if (a === 'up' && sec > 0) go(sec - 1)
      if (a === 'down' && sec < SECTIONS.length - 1) go(sec + 1)
      if (a === 'a' || a === 'right') (setInPane(true), setI(0))
      if (a === 'b') onClose()
      return
    }
    if (a === 'up') setI(Math.max(0, at - 1))
    if (a === 'down') setI(Math.min(rows.length - 1, at + 1))
    if (a === 'b') confirming ? setConfirming(null) : setInPane(false)
    if (row.kind === 'choice') {
      if (a === 'left') pick(row, row.at - 1)
      if (a === 'right') pick(row, row.at + 1)
      return
    }
    if (a === 'left') setInPane(false)
    // X: the row's second action (deleting a download), always behind a second X.
    if (a === 'x' && row.kind === 'action' && row.secondary) {
      const id = `x:${row.id}`
      if (confirming !== id) return setConfirming(id)
      setConfirming(null)
      return void attempt(row.id, row.secondary.run)
    }
    if (a !== 'a') return
    if (row.kind === 'text') edit(row)
    else if (row.confirm && confirming !== row.id) setConfirming(row.id)
    else (setConfirming(null), void attempt(row.id, row.run))
  })

  const view = preview ? 'preview' : editor ? 'editor' : section.id

  return (
    <motion.div
      className="fixed inset-0 z-20 flex bg-ground-deep"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: leave }}
      transition={settle}
      role="dialog"
      aria-label="Perfil"
    >
      <MenuNav
        sections={SECTIONS}
        current={sec}
        focused={!inPane && !editor && !preview}
        profile={prefs.profile}
        onPick={(k) => (setSec(k), setI(0), setInPane(false), setEditor(null), setPreview(null))}
      />
      <main className="flex min-w-0 flex-1 flex-col px-[3.5rem] pt-[4rem] pb-[8rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, transform: ty('1rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transition: leave }}
            transition={settle}
          >
            {preview ? (
              <AddonPreview addon={preview} installed={installed(preview)} busy={busy === 'preview'} error={error?.id === 'preview' ? error.text : undefined} />
            ) : editor ? (
              <>
                <h2 className="sheet-title">{editor.row.label}</h2>
                <p className="sheet-sub">
                  {pad ? 'Digite com o controle, ou cole com Colar o que copiou no navegador.' : 'Digite ou cole (Ctrl+V) e pressione Enter.'}
                </p>
                <FieldEditor
                  label={editor.row.label}
                  placeholder={editor.row.placeholder}
                  draft={editor.draft}
                  pos={editor.pos}
                  keys={keysFor(editor)}
                  upper={upperFor(editor)}
                  pad={pad}
                  busy={busy === editor.row.id}
                  error={error?.id === editor.row.id ? error.text : undefined}
                  onDraft={(draft) => setEditor({ ...editor, draft })}
                  onSave={() => void save(editor)}
                  onCancel={closeEditor}
                  onKey={(pos) => void type(editor, pos)}
                />
              </>
            ) : (
              <>
                <h2 className="sheet-title">{section.label}</h2>
                <p className="sheet-sub">{section.sub}</p>
                <ol className="mt-8 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none]" ref={list}>
                  {rows.map((r, j) => (
                    <li
                      key={r.id}
                      // A click focuses an option; a click on the focused one presses A.
                      onClick={() => (inPane && j === at ? press('a') : (setInPane(true), setI(j)))}
                      onMouseEnter={() => pointerMoved() && (setInPane(true), setI(j))}
                      className="cursor-pointer"
                    >
                      {r.group && <h3 className="mt-6 mb-2 px-5 text-label font-bold tracking-[0.16em] text-ink-3 uppercase">{r.group}</h3>}
                      <MenuRow
                        row={r}
                        focused={inPane && j === at}
                        confirming={confirming === r.id || confirming === `x:${r.id}`}
                        confirmKey={confirming === `x:${r.id}` ? 'x' : 'a'}
                        busy={busy === r.id}
                        error={error?.id === r.id ? error.text : undefined}
                        onPick={(k) => pick(r, k)}
                      />
                    </li>
                  ))}
                </ol>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <MenuHints editor={editor} preview={!!preview} pad={pad} inPane={inPane} row={row} confirming={confirming} />
    </motion.div>
  )
}
