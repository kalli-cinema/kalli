import { useState } from 'react'
import type { MetaPreview } from '../../../shared/types.ts'
import { sized } from '../data.ts'

/** Poster art, or the title typeset in its place when there is none (or it fails to load). */
export function Cover({ m, size = 'medium' }: { m: MetaPreview; size?: 'small' | 'medium' | 'large' }) {
  const [broken, setBroken] = useState(false)
  if (!m.poster || broken)
    return (
      <div className="cover-typeset">
        <span>{m.name}</span>
        {m.releaseInfo && <small>{m.releaseInfo}</small>}
      </div>
    )
  return <img src={sized(m.poster, size)} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />
}
