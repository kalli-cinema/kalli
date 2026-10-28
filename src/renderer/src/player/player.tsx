import { AnimatePresence } from 'motion/react'
import { useRef } from 'react'
import { Toasts } from '../_components/toasts.tsx'
import { usePrefs } from '../prefs.ts'
import { CinemaPrompt } from './_components/cinema-prompt.tsx'
import { Session } from './_components/session.tsx'
import { useView } from './_hooks/use-view.ts'

/**
 * The player overlay: its own transparent window over the mpv picture (see `src/main/overlay.ts`). One `Session` per
 * video, so a new episode starts with fresh controls while the count of automatic next episodes carries over.
 */
export function Player() {
  const view = useView()
  const prefs = usePrefs()
  // Three episodes in a row with nobody touching anything: the fourth waits for a press.
  const autoNext = useRef(0)
  return (
    <>
      {view && prefs && <Session key={view.req.key} view={view} profile={prefs.profile} autoNext={autoNext} />}
      <AnimatePresence>{view?.cinema && <CinemaPrompt key="cinema" {...view.cinema} />}</AnimatePresence>
      <Toasts top />
    </>
  )
}
