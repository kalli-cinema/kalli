import { useSyncExternalStore } from 'react'
import type { Profile, Profiles, Settings } from '../../shared/types.ts'
import { refreshLibrary } from './data.ts'
import { setSounds } from './sounds.ts'

const kalli = window.kalli

// --- Machine settings and the active profile: one snapshot every screen reads, updated by each change. ---

export type Prefs = { settings: Settings; profiles: Profile[]; profile: Profile }

let prefs: Prefs | null = null
const listeners = new Set<() => void>()

function emit(settings: Settings, { profiles, active }: Profiles) {
  const profile = profiles.find((p) => p.id === active) ?? profiles[0]
  prefs = { settings, profiles, profile }
  // The profile's accent stands in for edition yellow everywhere (styles.css `[data-accent]`).
  document.documentElement.dataset.accent = profile.accent
  // A 2.39:1 projector screen: the whole composition shrinks into its band (styles.css `[data-cih]`).
  document.documentElement.toggleAttribute('data-cih', settings.cih)
  setSounds(settings.uiSounds)
  listeners.forEach((l) => l())
}

const current = (): Profiles => ({ profiles: prefs!.profiles, active: prefs!.profile.id })

void Promise.all([kalli.settings(), kalli.profiles()]).then(([s, p]) => emit(s, p))

/** Null until the first load. */
export const usePrefs = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => prefs
  )

export const setSettings = async (patch: Partial<Settings>) => emit(await kalli.setSettings(patch), current())
/** Settings main changed on its own (pairing the lights). */
export const reloadSettings = async () => emit(await kalli.settings(), current())
export const setProfile = async (patch: Partial<Profile>) => emit(prefs!.settings, await kalli.setProfile(patch))

// Changing who is watching changes the history: Continuar and the watched marks follow.
const swap = async (next: Promise<Profiles>) => {
  emit(prefs!.settings, await next)
  await refreshLibrary()
}
export const addProfile = (name: string) => swap(kalli.addProfile(name))
export const switchProfile = (id: string) => swap(kalli.switchProfile(id))
export const removeProfile = (id: string) => swap(kalli.removeProfile(id))
