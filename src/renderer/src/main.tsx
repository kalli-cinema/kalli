import '@fontsource-variable/archivo/wdth.css'
import './styles.css'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import { App } from './app.tsx'
import { Player } from './player/player.tsx'

// One bundle, two windows: the app, and the player overlay main opens over mpv (`#player`).
const overlay = location.hash === '#player'
document.documentElement.classList.toggle('is-player', overlay)

createRoot(document.getElementById('root')!).render(
  <MotionConfig reducedMotion="user">{overlay ? <Player /> : <App />}</MotionConfig>
)
