import type { ReactNode } from 'react'
import type { Profile } from '../../../../shared/types.ts'
import { Avatar } from '../../_components/avatar.tsx'
import { AVATAR_ART } from '../../avatars.ts'
import { pointerMoved } from '../../input.ts'
import { cn } from '../../lib/utils.ts'
import { ACCENTS } from '../../profile/accents.ts'
import { PROFILE_ROWS } from '../steps.ts'
import { NextButton } from './next-button.tsx'

type StepProfileProps = { profile: Profile; at: number; onFocus: (i: number) => void; onAct: (i: number) => void }

const ROW = 'group flex cursor-pointer flex-col gap-[0.7rem] rounded-panel px-5 py-[1rem]'
const NAME = 'text-meta font-[650] group-data-[focused]:text-edition'

/** Step 1, Criar perfil: name, picture and colour, with the avatar answering every change. */
export function StepProfile({ profile, at, onFocus, onAct }: StepProfileProps) {
  const focused = (row: (typeof PROFILE_ROWS)[number]) => PROFILE_ROWS[at] === row
  const row = (k: number, label: string, body: ReactNode) => (
    <li
      className={cn(ROW, k === at && 'bg-ink/8')}
      data-focused={k === at || undefined}
      onClick={() => (onFocus(k), onAct(k))}
      onMouseEnter={() => pointerMoved() && onFocus(k)}
    >
      <span className={NAME}>{label}</span>
      {body}
    </li>
  )
  return (
    <>
      <h2 className="sheet-title">Quem vai assistir?</h2>
      <p className="sheet-sub">Cada perfil guarda o que já viu, o idioma preferido e a sua cor. Outras pessoas entram depois, em Perfil → Perfis.</p>
      <div className="mt-8 flex items-start gap-[3rem]">
        <span className="flex w-[13rem] flex-none flex-col items-center gap-4">
          <Avatar profile={profile} className="welcome-avatar size-[12rem] text-display" key={`${profile.avatar}${profile.accent}`} />
          <span className="max-w-full truncate text-lead font-[650]">{profile.name}</span>
        </span>
        <ol className="flex min-w-0 flex-1 flex-col">
          {row(0, 'Nome', <span className="text-hint text-ink-2">{profile.name} · A para mudar</span>)}
          {row(
            1,
            'Imagem',
            <span className="flex gap-[0.7rem]" role="radiogroup" aria-label="Imagem">
              {['' as const, ...AVATAR_ART.map((a) => a.id)].map((id) => (
                <span
                  key={id || 'initial'}
                  role="radio"
                  aria-checked={profile.avatar === id}
                  className={cn(
                    'rounded-full p-[0.2rem] transition-[box-shadow,scale] duration-150 ease-out',
                    profile.avatar === id && 'shadow-[0_0_0_0.18rem_var(--ink)]',
                    profile.avatar === id && focused('avatar') && 'scale-110 shadow-[0_0_0_0.18rem_var(--edition)]'
                  )}
                >
                  <Avatar profile={{ ...profile, avatar: id }} className="size-[3.6rem] text-lead" />
                </span>
              ))}
            </span>
          )}
          {row(
            2,
            'Cor',
            <span className="flex gap-[0.9rem]" role="radiogroup" aria-label="Cor">
              {ACCENTS.map((a) => (
                <span
                  key={a.key}
                  role="radio"
                  aria-checked={profile.accent === a.key}
                  aria-label={a.label}
                  className={cn(
                    'size-[2.6rem] rounded-full transition-[box-shadow,scale] duration-150 ease-out',
                    profile.accent === a.key && 'scale-110 shadow-[0_0_0_0.2rem_var(--ground),0_0_0_0.38rem_var(--ink)]'
                  )}
                  style={{ background: a.color }}
                />
              ))}
            </span>
          )}
          <li>
            <NextButton focused={focused('next')} label="Continuar" onFocus={() => onFocus(3)} onPress={() => onAct(3)} />
          </li>
        </ol>
      </div>
    </>
  )
}
