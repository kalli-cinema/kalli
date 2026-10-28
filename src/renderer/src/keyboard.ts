import type { Action } from '../../shared/types.ts'

export type Key = { label: string; value: string; span: number }
const k = (chars: string): Key[] => [...chars].map((c) => ({ label: c, value: c, span: 1 }))
const wide = (label: string, value: string, span: number): Key => ({ label, value, span })

// Alphabetical, so nobody hunts for QWERTY with a D-pad. Search gets accents; URLs get their symbols and shift.
export const LAYOUTS = {
  search: [
    k('abcdefg'),
    k('hijklmn'),
    k('opqrstu'),
    k('vwxyz01'),
    k('2345678'),
    k("9-:'&.?"),
    k('áéíóúãç'),
    [wide('Espaço', ' ', 3), wide('Apagar', 'back', 2), wide('Limpar', 'clear', 2)]
  ],
  url: [
    k('1234567890'),
    k('abcdefghij'),
    k('klmnopqrst'),
    k('uvwxyz./:-'),
    k('_=?&%|~+@#'),
    [wide('Maiúsc.', 'shift', 2), wide('Colar', 'paste', 3), wide('Apagar', 'back', 2), wide('Salvar', 'done', 3)]
  ]
} satisfies Record<string, Key[][]>

export type Pos = { r: number; c: number }

const center = (row: Key[], c: number) => row.slice(0, c).reduce((s, x) => s + x.span, 0) + row[c].span / 2
const keyAt = (row: Key[], x: number) => {
  let acc = 0
  for (let i = 0; i < row.length; i++) if (x < (acc += row[i].span)) return i
  return row.length - 1
}

/** Moves focus; returns null when the move leaves the keyboard on that side (the caller decides what's there). */
export function moveKey(rows: Key[][], p: Pos, a: Action): Pos | null {
  if (a === 'left') return p.c > 0 ? { ...p, c: p.c - 1 } : null
  if (a === 'right') return p.c < rows[p.r].length - 1 ? { ...p, c: p.c + 1 } : null
  if (a === 'up' || a === 'down') {
    const r = p.r + (a === 'up' ? -1 : 1)
    if (r < 0 || r >= rows.length) return null
    return { r, c: keyAt(rows[r], center(rows[p.r], p.c)) }
  }
  return p
}

/** Applies a plain key to the text; command keys (shift, paste, done) are the caller's. */
export function typeKey(text: string, value: string, upper = false): string {
  if (value === 'back') return text.slice(0, -1)
  if (value === 'clear') return ''
  return text + (upper ? value.toUpperCase() : value)
}
