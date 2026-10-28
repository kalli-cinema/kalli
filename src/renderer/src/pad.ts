import type { Action } from '../../shared/types.ts'

export type PadButton = 'A' | 'B' | 'X' | 'Y' | 'LB' | 'RB' | 'LT' | 'RT' | 'Menu' | 'View' | 'Up' | 'Down' | 'Left' | 'Right'
export type Dir = 'Up' | 'Down' | 'Left' | 'Right'
export const isDir = (b: PadButton): b is Dir => b === 'Up' || b === 'Down' || b === 'Left' || b === 'Right'

/** What a clickable hint presses for each button. */
export const PAD_ACTION: Record<PadButton, Action> = {
  A: 'a', B: 'b', X: 'x', Y: 'y', LB: 'lb', RB: 'rb', LT: 'lt', RT: 'rt', Menu: 'start', View: 'back',
  Up: 'up', Down: 'down', Left: 'left', Right: 'right'
}

/** The key shown for each pad button when the keyboard or mouse is in use (input.ts binds them). */
export const KEY_LABEL: Record<Exclude<PadButton, Dir>, string> = {
  A: 'Enter', B: 'Esc', X: 'D', Y: 'I', LB: 'Q', RB: 'E', LT: 'PgUp', RT: 'PgDn', Menu: 'M', View: '/'
}

export const DIR_NAME: Record<Dir, string> = { Up: 'Para cima', Down: 'Para baixo', Left: 'Esquerda', Right: 'Direita' }

export const ARROW: Record<Dir, string> = {
  Up: 'M12 18.5v-13m0 0-5 5m5-5 5 5',
  Down: 'M12 5.5v13m0 0-5-5m5 5 5-5',
  Left: 'M18.5 12h-13m0 0 5-5m-5 5 5 5',
  Right: 'M5.5 12h13m0 0-5-5m5 5-5 5'
}

// Pad glyphs and keycaps share one height (1.45em of the hint), so switching device never moves a hint.
// Both take `--hint-key`: one ink step brighter than the words beside them (styles.css hint strips).
export const KEY_INK = 'text-(--hint-key,currentColor)'
