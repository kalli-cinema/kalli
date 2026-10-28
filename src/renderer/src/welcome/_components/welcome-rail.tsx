import { motion } from 'motion/react'
import mark from '../../assets/brand/kalli-mark.svg'
import { usePlayerStatus } from '../../data.ts'
import { cn } from '../../lib/utils.ts'
import { settle } from '../../motion.ts'
import type { Step } from '../steps.ts'

const LABEL: Record<Step, string> = { profile: 'Seu perfil', addons: 'Fontes', ready: 'Pronto' }

/** The welcome's left column: the brand, where the person is in the three steps, and the player arriving. */
export function WelcomeRail({ step, steps }: { step: Step; steps: Step[] }) {
  const player = usePlayerStatus()
  const at = steps.indexOf(step)
  const pct = player.progress ? ` ${Math.floor(player.progress * 100)}%` : ''
  return (
    <motion.section
      className="flex w-[44rem] flex-none flex-col px-[3.5rem] pt-[6rem] pb-[8rem]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={settle}
    >
      {/* The mark turns in once, like a kaleidoscope's tube; reduced motion keeps it still (styles.css). */}
      <img src={mark} alt="" className="welcome-mark size-[7.5rem]" draggable={false} />
      <h1 className="mt-6 text-display leading-[0.9] font-[800] uppercase [font-stretch:64%]">Kalli</h1>
      <p className="mt-4 max-w-[30ch] text-body text-ink-2">Sua sala de cinema.</p>

      <ol className="mt-14 flex flex-col gap-[0.9rem]" aria-label="Etapas">
        {steps.map((s, k) => (
          <li key={s} className={cn('flex items-center gap-[1rem] text-meta text-ink-3', k === at && 'font-[650] text-ink', k < at && 'text-ink-2')} aria-current={k === at ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-[2.3rem] flex-none place-items-center rounded-full text-hint font-[700] tnum shadow-[inset_0_0_0_0.14rem_var(--ink-3)]',
                k === at && 'bg-edition text-on-edition shadow-none',
                k < at && 'bg-ink/16 shadow-none'
              )}
            >
              {k + 1}
            </span>
            {LABEL[s]}
          </li>
        ))}
      </ol>

      <div className="mt-auto max-w-[34rem]" role="status">
        <p className="text-hint font-[650]">Player de vídeo</p>
        <p className="mt-1 text-hint text-ink-2 tnum">
          {player.state === 'ready'
            ? 'Pronto.'
            : player.state === 'installing'
              ? `Preparando, só nesta primeira vez…${pct}`
              : `${player.error ?? 'Não deu para preparar.'} Ele tenta de novo no primeiro filme.`}
        </p>
        {player.state === 'installing' && (
          <span className="mt-3 block h-[0.22rem] overflow-hidden rounded-full bg-ink/16">
            <span className="block h-full rounded-full bg-edition transition-[width] duration-300 ease-out" style={{ width: `${(player.progress ?? 0) * 100}%` }} />
          </span>
        )}
      </div>
    </motion.section>
  )
}
