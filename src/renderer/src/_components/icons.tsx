// One icon family: 24-unit grid, 1.75 stroke, round caps. Pad glyphs (pad-glyph.tsx) mirror the controller's own faces.

type P = { className?: string }

export const Play = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
)

export const DownloadIcon = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
  </svg>
)

export const Check = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)

export const Alert = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9.25" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </svg>
)

export const Pause = ({ className }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
  </svg>
)
