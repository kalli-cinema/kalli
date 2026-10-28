import { Puzzle } from 'lucide-react'
import { useState } from 'react'
import type { Addon } from '../../../shared/types.ts'
import { cn } from '../lib/utils.ts'

/** An addon's logo, or a puzzle piece when it has none (or it fails to load). */
export function AddonLogo({ addon, className }: { addon?: Addon; className?: string }) {
  const [broken, setBroken] = useState(false)
  const logo = !broken && addon?.manifest.logo
  return (
    <span className={cn('grid size-[3rem] flex-none place-items-center overflow-hidden rounded-key bg-ground-raised text-ink-3', className)}>
      {logo ? (
        <img src={logo} alt="" className="size-full object-contain" decoding="async" onError={() => setBroken(true)} />
      ) : (
        <Puzzle className="size-[45%]" strokeWidth={1.75} aria-hidden />
      )}
    </span>
  )
}
