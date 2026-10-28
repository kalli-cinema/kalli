import type { AvatarId } from '../../shared/types.ts'
import claquete from './assets/avatars/claquete.svg'
import controle from './assets/avatars/controle.svg'
import ingresso from './assets/avatars/ingresso.svg'
import oculos from './assets/avatars/oculos.svg'
import pipoca from './assets/avatars/pipoca.svg'
import rolo from './assets/avatars/rolo.svg'

/** The preset profile pictures (drawn by `scripts/brand.py`), in the order they are offered. */
export const AVATAR_ART: { id: AvatarId; label: string; src: string }[] = [
  { id: 'pipoca', label: 'Pipoca', src: pipoca },
  { id: 'claquete', label: 'Claquete', src: claquete },
  { id: 'rolo', label: 'Rolo de filme', src: rolo },
  { id: 'oculos', label: 'Óculos 3D', src: oculos },
  { id: 'ingresso', label: 'Ingresso', src: ingresso },
  { id: 'controle', label: 'Controle', src: controle }
]

export const avatarSrc = (id: AvatarId | '') => AVATAR_ART.find((a) => a.id === id)?.src
