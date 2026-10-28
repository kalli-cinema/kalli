import type { Accent } from '../../../shared/types.ts'

/** Perfil → Aparência. Colours mirror styles.css `[data-accent]`: edition yellow and Tailwind 400s, all light enough for on-edition text. */
export const ACCENTS: { key: Accent; label: string; color: string }[] = [
  { key: 'edition', label: 'Amarelo', color: 'var(--edition-yellow)' },
  { key: 'orange', label: 'Laranja', color: 'var(--color-orange-400)' },
  { key: 'rose', label: 'Rosa', color: 'var(--color-rose-400)' },
  { key: 'violet', label: 'Violeta', color: 'var(--color-violet-400)' },
  { key: 'sky', label: 'Azul', color: 'var(--color-sky-400)' },
  { key: 'emerald', label: 'Verde', color: 'var(--color-emerald-400)' }
]

export const accentColor = (a: Accent) => (ACCENTS.find((x) => x.key === a) ?? ACCENTS[0]).color
