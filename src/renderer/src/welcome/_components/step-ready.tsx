import type { Profile } from '../../../../shared/types.ts'
import { Avatar } from '../../_components/avatar.tsx'
import { NextButton } from './next-button.tsx'

/** Step 3, Pronto: the person's avatar and the way into the wall. */
export function StepReady({ profile, busy, onAct }: { profile: Profile; busy: boolean; onAct: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center pb-[6rem]">
      <Avatar profile={profile} className="welcome-avatar size-[12rem] text-display" />
      <h2 className="mt-8 text-title leading-[0.95] font-[800] [font-stretch:66%]">Tudo pronto, {profile.name}.</h2>
      <p className="mt-4 max-w-[46ch] text-body text-ink-2">
        Escolha um título no mural e pressione A. O Kalli escolhe a melhor cópia para a sua tela, o seu som e a sua conexão.
      </p>
      <NextButton focused label={busy ? 'Abrindo…' : 'Começar a assistir'} onFocus={() => {}} onPress={onAct} />
    </div>
  )
}
