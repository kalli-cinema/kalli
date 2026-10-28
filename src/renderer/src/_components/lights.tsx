import { motion } from 'motion/react'
import type { PlayRequest } from '../../../shared/types.ts'
import { usePlayerStatus } from '../data.ts'
import { useActions } from '../input.ts'
import { settle, ty } from '../motion.ts'
import { Hint } from './hint.tsx'

/** House lights: the room goes dark, the title card holds a beat, then mpv takes the screen. B backs out. */
export function Lights({ req, onCancel }: { req: PlayRequest; onCancel: () => void }) {
  useActions((a) => a === 'b' && onCancel())
  const player = usePlayerStatus()
  // The very first play may still be waiting for the player to arrive: say so, with how far along it is.
  const status =
    player.state === 'installing'
      ? `Preparando o player pela primeira vez…${player.progress ? ` ${Math.floor(player.progress * 100)}%` : ''}`
      : req.torrent
        ? 'Procurando fontes do torrent…'
        : 'Abrindo a cópia…'
  return (
    <motion.div
      className="lights"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.9, ease: settle.ease } }}
      // The press is answered at once: the room starts going dark on the first frame, not after an ease-in.
      transition={{ duration: 0.5, ease: settle.ease }}
    >
      <motion.div initial={{ opacity: 0, transform: ty('0.75rem') }} animate={{ opacity: 1, transform: ty(0) }} transition={{ ...settle, delay: 0.25 }}>
        <h1 className="lights-title">{req.title}</h1>
        <p className="lights-label">{req.label}</p>
        <p className="lights-status" role="status">
          <span className="tnum">{status}</span> <Hint b="B">Cancelar</Hint>
        </p>
      </motion.div>
    </motion.div>
  )
}
