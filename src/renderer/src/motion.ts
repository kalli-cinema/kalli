/** Travel across the screen (wall, rails, sheets, lists): one spring everywhere. */
export const travel = { type: 'spring', stiffness: 420, damping: 42, mass: 0.9 } as const

/** Content settling into place after a morph or a mode change. */
export const settle = { duration: 0.55, ease: [0.16, 1, 0.3, 1] } as const

/** Leaving answers a press: it clears the stage fast, so what was asked for arrives sooner. */
export const leave = { duration: 0.15, ease: [0.16, 1, 0.3, 1] } as const

// Motion runs a whole `transform` string on the compositor (WAAPI, springs included); its x/y shorthands
// tick on the main thread and drop frames while posters decode. Everything that travels goes through these.
const len = (v: number | string) => (typeof v === 'number' ? `${v}px` : v)
export const tx = (v: number | string) => `translateX(${len(v)})`
export const ty = (v: number | string) => `translateY(${len(v)})`
