import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { Addon } from '../../../shared/types.ts'
import { Hint } from '../_components/hint.tsx'
import { FieldEditor } from '../_components/field-editor.tsx'
import { AVATAR_ART } from '../avatars.ts'
import { ipcError } from '../format.ts'
import { useActions, useInputMode } from '../input.ts'
import { LAYOUTS, moveKey, typeKey, type Pos } from '../keyboard.ts'
import { leave, settle, ty } from '../motion.ts'
import { setProfile, setSettings, usePrefs } from '../prefs.ts'
import { ACCENTS } from '../profile/accents.ts'
import { StepAddons } from './_components/step-addons.tsx'
import { StepProfile } from './_components/step-profile.tsx'
import { StepReady } from './_components/step-ready.tsx'
import { WelcomeRail } from './_components/welcome-rail.tsx'
import { PROFILE_ROWS, STEPS, type Step } from './steps.ts'

const kalli = window.kalli

const AVATARS = ['' as const, ...AVATAR_ART.map((a) => a.id)]

type Entry = { kind: 'name' | 'url'; draft: string; pos: Pos; upper: boolean }

/**
 * First run: who is watching (name, picture, colour), then the sources (Cinemeta, The Movie Database and
 * OpenSubtitles come installed; more by link), then ready. The player is fetched in the background throughout.
 */
export function Welcome({ onDone }: { onDone: () => void }) {
  const prefs = usePrefs()!
  const profile = prefs.profile
  const pad = useInputMode() === 'pad'
  const [step, setStep] = useState<Step>('profile')
  const [i, setI] = useState(0)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The defaults install on the first `addons` call; each starts ticked, and an unticked one is removed on Continuar.
  const [addons, setAddons] = useState<Addon[] | null>(null)
  const [off, setOff] = useState<Set<string>>(new Set())
  useEffect(() => void kalli.addons().then(setAddons, () => setAddons([])), [])

  const go = (s: Step) => (setStep(s), setI(0), setError(null))
  const rows = step === 'profile' ? PROFILE_ROWS.length : step === 'addons' ? (addons?.length ?? 0) + 2 : 1

  const keys = (e: Entry) => LAYOUTS[e.kind === 'url' ? 'url' : 'search']
  // Names capitalize each word by themselves; URLs keep the shift key.
  const upper = (e: Entry) => (e.kind === 'name' ? /(^|\s)$/.test(e.draft) : e.upper)

  const save = async (e: Entry) => {
    setBusy(true)
    setError(null)
    try {
      if (e.kind === 'name') await setProfile({ name: e.draft })
      else {
        // Installed straight away: the person typed the link on purpose; Perfil → Addons previews first.
        setAddons(await kalli.installAddon(e.draft))
      }
      setEntry(null)
    } catch (err) {
      setError(ipcError(err))
    } finally {
      setBusy(false)
    }
  }

  const type = async (e: Entry, pos: Pos) => {
    const value = keys(e)[pos.r][pos.c].value
    if (value === 'shift') return setEntry({ ...e, pos, upper: !e.upper })
    if (value === 'done') return void save(e)
    if (value === 'paste') return setEntry({ ...e, pos, draft: e.draft + (await kalli.readClipboard()) })
    setEntry({ ...e, pos, draft: typeKey(e.draft, value, upper(e)) })
  }

  const cycle = <T,>(list: readonly T[], at: T, by: number) => list[(list.indexOf(at) + by + list.length) % list.length]

  const leaveAddons = async () => {
    setBusy(true)
    for (const url of off) await kalli.removeAddon(url).catch(() => {})
    setBusy(false)
    go('ready')
  }

  const finish = async () => {
    setBusy(true)
    await setSettings({ onboarded: true })
    onDone()
  }

  const act = (k: number) => {
    if (step === 'profile') {
      const row = PROFILE_ROWS[k]
      if (row === 'name') setEntry({ kind: 'name', draft: '', pos: { r: 0, c: 0 }, upper: false })
      if (row === 'avatar') void setProfile({ avatar: cycle(AVATARS, profile.avatar, 1) })
      if (row === 'accent') void setProfile({ accent: cycle(ACCENTS.map((a) => a.key), profile.accent, 1) })
      if (row === 'next') go('addons')
    } else if (step === 'addons' && addons) {
      if (k < addons.length) {
        const url = addons[k].transportUrl
        setOff((o) => {
          const next = new Set(o)
          if (!next.delete(url)) next.add(url)
          return next
        })
      } else if (k === addons.length) setEntry({ kind: 'url', draft: '', pos: { r: 1, c: 0 }, upper: false })
      else void leaveAddons()
    } else if (step === 'ready') void finish()
  }

  useActions((a) => {
    if (busy) return
    if (entry && !pad) {
      // A real keyboard types into the field; Enter/A saves, Esc/B cancels.
      if (a === 'a' || a === 'start') void save(entry)
      if (a === 'b') (setEntry(null), setError(null))
      return
    }
    if (entry) {
      const next = moveKey(keys(entry), entry.pos, a)
      if (next && next !== entry.pos) setEntry({ ...entry, pos: next })
      if (a === 'a') void type(entry, entry.pos)
      if (a === 'start') void save(entry)
      if (a === 'b') entry.draft ? setEntry({ ...entry, draft: entry.draft.slice(0, -1) }) : (setEntry(null), setError(null))
      return
    }
    if (a === 'up') setI(Math.max(0, i - 1))
    if (a === 'down') setI(Math.min(rows - 1, i + 1))
    if (a === 'a') act(i)
    if (a === 'b' && step !== 'profile') go(STEPS[STEPS.indexOf(step) - 1])
    if (step === 'profile' && (a === 'left' || a === 'right')) {
      const by = a === 'left' ? -1 : 1
      if (PROFILE_ROWS[i] === 'avatar') void setProfile({ avatar: cycle(AVATARS, profile.avatar, by) })
      if (PROFILE_ROWS[i] === 'accent') void setProfile({ accent: cycle(ACCENTS.map((x) => x.key), profile.accent, by) })
    }
  })

  return (
    <motion.div className="fixed inset-0 z-30 flex bg-ground" exit={{ opacity: 0, transition: leave }} role="dialog" aria-label="Bem-vindo ao Kalli">
      <WelcomeRail step={step} steps={STEPS} />
      <main className="flex min-w-0 flex-1 flex-col pt-[6rem] pr-[3.5rem] pb-[8rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={entry ? `entry-${entry.kind}` : step}
            className="flex min-h-0 flex-1 flex-col"
            initial={{ opacity: 0, transform: ty('1rem') }}
            animate={{ opacity: 1, transform: ty(0) }}
            exit={{ opacity: 0, transition: leave }}
            transition={settle}
          >
            {entry ? (
              <>
                <h2 className="sheet-title">{entry.kind === 'name' ? 'Como você se chama?' : 'Adicionar por link'}</h2>
                <p className="sheet-sub">
                  {entry.kind === 'url'
                    ? 'Cole o link do manifest.json do addon. Qualquer addon do Stremio funciona.'
                    : pad
                      ? 'Digite com o controle e escolha Salvar, ou pressione Menu.'
                      : 'Digite e pressione Enter.'}
                </p>
                <FieldEditor
                  label={entry.kind === 'name' ? 'Nome' : 'Link do addon'}
                  placeholder={entry.kind === 'name' ? 'Seu nome ou apelido' : 'https://…/manifest.json'}
                  draft={entry.draft}
                  pos={entry.pos}
                  keys={keys(entry)}
                  upper={upper(entry)}
                  pad={pad}
                  busy={busy}
                  error={error ?? undefined}
                  onDraft={(draft) => setEntry({ ...entry, draft })}
                  onSave={() => void save(entry)}
                  onCancel={() => (setEntry(null), setError(null))}
                  onKey={(pos) => void type(entry, pos)}
                />
              </>
            ) : step === 'profile' ? (
              <StepProfile profile={profile} at={i} onFocus={setI} onAct={act} />
            ) : step === 'addons' ? (
              <StepAddons addons={addons} off={off} at={i} busy={busy} onFocus={setI} onAct={act} />
            ) : (
              <StepReady profile={profile} busy={busy} onAct={() => act(0)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <span className="sheet-hints">
        {entry ? (
          <>
            <Hint b="A">Digitar</Hint>
            <Hint b="B">Apagar</Hint>
            <Hint b="Menu">Salvar</Hint>
          </>
        ) : (
          <>
            {step === 'profile' && (PROFILE_ROWS[i] === 'avatar' || PROFILE_ROWS[i] === 'accent') && <Hint b={['Left', 'Right']}>Escolher</Hint>}
            <Hint b="A">{step === 'ready' ? 'Começar' : 'Selecionar'}</Hint>
            {step !== 'profile' && <Hint b="B">Voltar</Hint>}
          </>
        )}
      </span>
    </motion.div>
  )
}
