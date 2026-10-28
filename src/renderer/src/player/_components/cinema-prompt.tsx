import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Hint } from '../../_components/hint.tsx'
import { useActions } from '../../input.ts'
import { leave, settle, ty } from '../../motion.ts'

const kalli = window.kalli

/**
 * Cinema mode just moved the screen into HDR, the first frame waiting behind this card. A keeps it for the session,
 * B goes back; with no answer (a screen that went dark can't be read) it goes back by itself at `until`.
 */
export function CinemaPrompt({ until }: { until: number }) {
  const left = () => Math.max(0, Math.ceil((until - Date.now()) / 1000))
  const [seconds, setSeconds] = useState(left)
  useEffect(() => {
    const t = setInterval(() => setSeconds(left()), 250)
    return () => clearInterval(t)
  }, [until])
  useActions((a) => {
    if (a === 'a' || a === 'b') void kalli.playerDo({ kind: 'cinema', keep: a === 'a' })
  })

  return (
    <motion.section
      role="alertdialog"
      aria-labelledby="cinema-title"
      aria-describedby="cinema-body cinema-timer"
      className="absolute top-1/2 left-1/2 w-[46rem] -translate-1/2 rounded-panel bg-ground-deep/92 p-[2.4rem] shadow-[0_1.5rem_3rem_-1rem_rgb(0_0_0/0.7)]"
      initial={{ opacity: 0, transform: ty('1.5rem') }}
      animate={{ opacity: 1, transform: ty(0) }}
      exit={{ opacity: 0, transition: leave }}
      transition={settle}
    >
      <p className="text-hint font-bold tracking-[0.04em] text-edition">Modo cinema</p>
      <h2 id="cinema-title" className="mt-[0.4rem] text-lead font-[650] text-balance">
        A tela está em HDR, como o filme
      </h2>
      <p id="cinema-body" className="mt-[0.6rem] text-body text-pretty text-ink-2">
        O brilho e as cores do HDR chegam inteiros à tela. A imagem voltou certinha?
      </p>
      <p className="mt-[1.4rem] flex flex-wrap gap-x-[1.4rem] gap-y-[0.8rem] text-hint text-ink-2">
        <Hint b="A">Manter</Hint>
        <Hint b="B">Voltar como estava</Hint>
        {/* Read once with the question; a ticking live region would interrupt every second. */}
        <span id="cinema-timer" className="ml-auto tnum text-ink-3">
          Volta sozinha em {seconds} s
        </span>
      </p>
    </motion.section>
  )
}
