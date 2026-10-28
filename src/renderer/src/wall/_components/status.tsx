import type { ReactNode } from 'react'

/** The baseline when there is no title to show: what happened, and what to press next. */
export function Status({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <footer className="entry" aria-live="polite">
      <div className="entry-main">
        <p className="entry-meta">{text}</p>
        {children && <p className="entry-actions">{children}</p>}
      </div>
    </footer>
  )
}
