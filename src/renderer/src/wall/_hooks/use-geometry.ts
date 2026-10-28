import { useEffect, useState } from 'react'

// Geometry in rem; the root font-size is 1/120 of the viewport width, so the wall scales from 1080p to 4K unchanged.
export const ROWS = 3
export const PAD = 3.5
export const TOP = 6.5
const BOTTOM = 13.5
export const GAP = 1.25
export const RAIL_H = 16.5

/** Poster size and how many columns fit, from the viewport. */
export function useGeometry() {
  const [vp, set] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => {
    const f = () => set({ w: innerWidth, h: innerHeight })
    addEventListener('resize', f)
    return () => removeEventListener('resize', f)
  }, [])
  const rem = vp.w / 120
  const rowH = (vp.h / rem - TOP - BOTTOM - GAP * (ROWS - 1)) / ROWS
  const posterW = (rowH * 2) / 3
  const colW = posterW + GAP
  return { rem, rowH, posterW, colW, fullCols: Math.floor((120 - PAD) / colW) }
}
