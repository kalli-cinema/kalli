import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Action } from '../../shared/types.ts'
import { cueFor } from './sounds.ts'

type Handler = (a: Action) => void
type Watcher = (a: Action) => boolean | void

// The top-most mounted screen or panel owns input; closing it hands input back to the one below.
const stack: { current: Handler }[] = []
const watchers = new Set<Watcher>()

/** Sends an action as if pressed: clickable hints use it, so a mouse can do anything a key can. */
export const press = (a: Action) => {
  cueFor(a)
  let swallowed = false
  watchers.forEach((w) => (swallowed = w(a) === true || swallowed))
  if (!swallowed) stack.at(-1)?.current(a)
}

/** Sees every action before the screen on top; returning true consumes it (dismissing an error must not also replay). */
export function onAnyAction(fn: Watcher) {
  watchers.add(fn)
  return () => void watchers.delete(fn)
}

// --- Which device the household is using right now. Hints speak its language, like modern games. ---

type InputMode = 'keyboard' | 'pad'
let mode: InputMode = 'keyboard' // desktop first; the first pad press flips it
const modeListeners = new Set<() => void>()
function setMode(next: InputMode) {
  if (next === mode) return
  mode = next
  document.body.classList.toggle('is-pad', mode === 'pad')
  modeListeners.forEach((l) => l())
}

export const useInputMode = () =>
  useSyncExternalStore(
    (l) => (modeListeners.add(l), () => modeListeners.delete(l)),
    () => mode
  )

// Chromium also fires mouse events when content slides under a resting pointer.
// Only a pointer that actually moved may steer focus by hovering. After a wheel step the hand on the mouse
// wiggles a few pixels while the wall slides under it: hover waits for a deliberate move (24 px) before it
// takes focus back from the wheel.
let lastMove = 0
let sinceWheel = Infinity
export const pointerMoved = () => mode === 'keyboard' && performance.now() - lastMove < 200 && sinceWheel > 24

window.addEventListener(
  'pointermove',
  (e) => {
    if (!e.movementX && !e.movementY) return
    lastMove = performance.now()
    sinceWheel += Math.hypot(e.movementX, e.movementY)
    setMode('keyboard')
  },
  { passive: true }
)
window.addEventListener(
  'wheel',
  () => {
    sinceWheel = 0
    setMode('keyboard')
  },
  { passive: true }
)
// A clicked button must not keep focus: the next Enter belongs to the screen, not to that button.
window.addEventListener('click', (e) => (e.target as Element).closest?.('button')?.blur(), true)
window.addEventListener('mousedown', (e) => {
  setMode('keyboard')
  // The mouse's back button goes back, as in a browser.
  if (e.button === 3) {
    e.preventDefault()
    press('b')
  }
})

// Desktop shortcuts. The labels shown in hints are in pad.ts (KEY_LABEL); the extras are aliases.
const KEYS: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'a',
  ' ': 'a',
  Escape: 'b',
  Backspace: 'b',
  d: 'x',
  x: 'x',
  i: 'y',
  y: 'y',
  q: 'lb',
  e: 'rb',
  PageUp: 'lt',
  PageDown: 'rt',
  m: 'start',
  ',': 'start',
  '/': 'back'
}

// Left/right stay in the field to move the caret; up/down and Esc leave it.
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Escape'])

window.kalli.onInput((a) => {
  setMode('pad')
  press(a)
})
window.addEventListener('keydown', (e) => {
  setMode('keyboard')
  const a = e.ctrlKey && e.key.toLowerCase() === 'f' ? 'back' : e.ctrlKey || e.altKey || e.metaKey ? undefined : KEYS[e.key]
  if (!a) return
  // Text fields keep their keys; a `data-nav` field (search) still lets arrows and Esc steer the screen.
  if (e.target instanceof HTMLInputElement && !(e.target.hasAttribute('data-nav') && NAV_KEYS.has(e.key))) return
  e.preventDefault()
  press(a)
})

export function useActions(handler: Handler, active = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const entry = { current: (a: Action) => ref.current(a) }
    stack.push(entry)
    return () => void stack.splice(stack.indexOf(entry), 1)
  }, [active])
}
