import type { Profile } from '../../../shared/types.ts'
import { avatarSrc } from '../avatars.ts'
import { cn } from '../lib/utils.ts'
import { accentColor } from '../profile/accents.ts'

/** A person: their picture, or their initial, on their own accent colour. */
export function Avatar({ profile, className }: { profile: Pick<Profile, 'name' | 'accent' | 'avatar'>; className?: string }) {
  const src = avatarSrc(profile.avatar)
  return (
    <span
      className={cn('grid size-[3rem] flex-none place-items-center overflow-hidden rounded-full font-[800] text-on-edition uppercase', className)}
      style={{ background: accentColor(profile.accent) }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full" draggable={false} /> : profile.name.trim().charAt(0)}
    </span>
  )
}
