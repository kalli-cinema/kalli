import { useRef, type WheelEvent } from 'react'

/** Wheel or trackpad: one step per notch (60 px of travel) on whichever axis it scrolls; `dir` is -1 or 1. */
export function useWheelStep(onStep: (dir: number) => void) {
  const travel = useRef(0)
  return (e: WheelEvent) => {
    travel.current += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
    if (Math.abs(travel.current) < 60) return
    const dir = Math.sign(travel.current)
    travel.current = 0
    onStep(dir)
  }
}
