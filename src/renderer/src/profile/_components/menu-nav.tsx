import type { Profile } from '../../../../shared/types.ts'
import { cn } from '../../lib/utils.ts'
import type { Section } from '../rows.ts'
import { Avatar } from '../../_components/avatar.tsx'

type MenuNavProps = { sections: Section[]; current: number; focused: boolean; profile: Profile; onPick: (i: number) => void }

/** The menu's left column: who is watching, then the sections. The current one is filled with the accent while the column has focus. */
export function MenuNav({ sections, current, focused, profile, onPick }: MenuNavProps) {
  return (
    <nav className="flex w-[32rem] flex-none flex-col bg-ground px-[2.5rem] pt-[4rem]" aria-label="Seções do perfil">
      <header className="flex items-center gap-[1.25rem] px-5">
        <Avatar profile={profile} className="size-[4.5rem] text-title-s" />
        <span className="flex min-w-0 flex-col">
          <span className="text-label font-bold tracking-[0.16em] text-ink-3 uppercase">Perfil</span>
          <span className="truncate text-lead font-[650]">{profile.name}</span>
        </span>
      </header>
      <ol className="mt-10 flex flex-col gap-[0.4rem]">
        {sections.map((s, k) => {
          const Icon = s.icon
          return (
            <li key={s.id}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onPick(k)}
                aria-current={k === current ? 'page' : undefined}
                className={cn(
                  'flex h-[4.4rem] w-full cursor-pointer items-center gap-[1.1rem] rounded-panel px-5 text-meta font-[650] text-ink-2',
                  'transition-[background-color,color] duration-150 ease-out',
                  k === current && 'bg-ink/8 text-ink',
                  k === current && focused && 'bg-edition text-on-edition'
                )}
              >
                <Icon className="size-[1.7rem] flex-none" strokeWidth={1.75} aria-hidden />
                {s.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
