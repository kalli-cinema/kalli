import { useEffect, useRef } from 'react'
import type { Key, Pos } from '../keyboard.ts'
import { Alert } from './icons.tsx'
import { Keys } from './keys.tsx'

type FieldEditorProps = {
  label: string
  placeholder: string
  draft: string
  pos: Pos
  keys: Key[][]
  upper: boolean
  pad: boolean
  busy: boolean
  error?: string
  onDraft: (draft: string) => void
  onSave: () => void
  onCancel: () => void
  onKey: (pos: Pos) => void
}

/** A text option being typed: the field, its error, and the on-screen keyboard when the pad is in use. */
export function FieldEditor(p: FieldEditorProps) {
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => field.current?.focus(), [])
  return (
    <div className="mt-8 w-[64rem]">
      <input
        ref={field}
        className="h-[3.8rem] w-full rounded-panel border-[0.12rem] border-ink/25 bg-ground px-[1.1rem] text-meta text-ink caret-edition placeholder:text-ink-3 focus:border-edition focus:outline-none aria-invalid:border-alert"
        value={p.draft}
        placeholder={p.placeholder}
        onChange={(e) => p.onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') p.onSave()
          if (e.key === 'Escape') p.onCancel()
        }}
        disabled={p.busy}
        spellCheck={false}
        aria-label={p.label}
        aria-invalid={!!p.error || undefined}
        aria-describedby={p.error ? 'editor-error' : undefined}
      />
      {p.error && (
        <p className="mt-3 flex items-center gap-2 text-hint text-alert" id="editor-error">
          <Alert className="ico" /> {p.error}
        </p>
      )}
      {p.busy && <p className="mt-3 text-hint text-ink-2">Conferindo…</p>}
      {p.pad && <Keys className="mt-7" rows={p.keys} pos={p.pos} upper={p.upper} onPress={p.onKey} />}
    </div>
  )
}
