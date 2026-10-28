import { AnimatePresence, LayoutGroup } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { MetaPreview, PlayRequest } from '../../shared/types.ts'
import { Lights } from './_components/lights.tsx'
import { Notice } from './_components/notice.tsx'
import { PreShow } from './_components/pre-show.tsx'
import { Toasts } from './_components/toasts.tsx'
import { refreshLibrary, useLibrary, useSections, type RailItem } from './data.ts'
import { Detail } from './detail/detail.tsx'
import { ipcError } from './format.ts'
import { onAnyAction, useInputMode } from './input.ts'
import { Search } from './search/search.tsx'
import { switchProfile, usePrefs } from './prefs.ts'
import { ProfileMenu } from './profile/profile.tsx'
import { cue } from './sounds.ts'
import { Welcome } from './welcome/welcome.tsx'
import { Wall } from './wall/wall.tsx'
import { WhoIsWatching } from './who-is-watching/who-is-watching.tsx'

const kalli = window.kalli

export function App() {
  const prefs = usePrefs()
  // Addons change in Perfil and on first run: the wall's sections reload after either.
  const [addonsVersion, setAddonsVersion] = useState(0)
  const sections = useSections(addonsVersion)
  const [section, setSection] = useState(0)
  const reloadSections = () => setAddonsVersion((v) => v + 1)
  useEffect(() => void (sections && section >= sections.length && setSection(0)), [sections])
  const [open, setOpen] = useState<MetaPreview | null>(null)
  const [playing, setPlaying] = useState<PlayRequest | null>(null)
  const [profile, setProfile] = useState(false)
  const [search, setSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bigPicture, setBigPicture] = useState(false)
  const inputMode = useInputMode()
  const lib = useLibrary()
  // Asked once per launch, only in a house with more than one profile.
  const [picked, setPicked] = useState(false)
  const [preshow, setPreshow] = useState<PlayRequest | null>(null)

  useEffect(
    () =>
      kalli.onPlayerExit((st) => {
        setPlaying(null)
        if (st.error) setError(st.error)
      }),
    []
  )
  useEffect(() => kalli.onBigPicture(setBigPicture), [])
  // A film picked on another film's end card: its page opens as the player goes.
  useEffect(() => kalli.onOpen((m) => (setAutoPlay(false), setOpen(m))), [])
  useEffect(() => void document.body.classList.toggle('is-bigpicture', bigPicture), [bigPicture])
  // Errors stay until the next press, so nobody misses one while looking away from the screen.
  // That press only dismisses: it must not also replay the cópia that just failed.
  const errorRef = useRef(error)
  errorRef.current = error
  useEffect(
    () =>
      onAnyAction(() => {
        if (!errorRef.current) return
        setError(null)
        return true
      }),
    []
  )

  // The title card holds just long enough for the lights to go down; mpv starting covers the rest.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const play = (req: PlayRequest, preshowDone = false) => {
    if (!preshowDone) void kalli.rumble('play').catch(() => {})
    // A film from its beginning gets its pre-show first (Perfil → Preferências); the curtain chord waits for the film.
    if (!preshowDone && prefs?.settings.preshow && req.type === 'movie' && !lib.progress[req.key]) return setPreshow(req)
    cue('play')
    setPlaying(req)
    timer.current = setTimeout(
      () =>
        kalli.play(req).catch(async (e: Error) => {
          setPlaying(null)
          // A first-run player that couldn't be fetched isn't the cópia's fault.
          const player = await kalli.player()
          setError(
            player.state === 'error'
              ? `O player não ficou pronto: ${player.error}`
              : `Não deu para abrir esta cópia (${ipcError(e)}). Escolha outra em Ver cópias.`
          )
        }),
      650
    )
  }
  const cancelPlay = () => {
    clearTimeout(timer.current)
    void kalli.cancelPlay()
    setPlaying(null)
  }

  const [autoPlay, setAutoPlay] = useState(false)
  const openTitle = (m: MetaPreview) => (setAutoPlay(false), setOpen(m))
  const openRail = (item: RailItem, andPlay = false) => {
    setAutoPlay(andPlay)
    // The entry fetches the full meta; this is enough to start the morph.
    setOpen({ id: item.metaId, type: item.type, name: item.title.split(' · ')[0], poster: item.poster, background: item.background })
  }

  // A next episode has no cópia yet: its entry opens on it and plays the best one as soon as it's ranked.
  const resume = (item: RailItem) => {
    const req = item.progress ?? item.download
    if (req) play({ ...req, label: item.download?.label ?? req.label })
    else openRail(item, true)
  }

  const toggleDownload = (item: RailItem) => {
    const d = item.download!
    void (d.state === 'downloading' ? kalli.pauseDownload(d.key) : kalli.resumeDownload(d.key)).then(refreshLibrary)
  }

  if (!sections || !prefs) return <div className="boot" />
  if (!prefs.settings.onboarded) return <Welcome onDone={reloadSections} />

  const asking = !picked && prefs.profiles.length > 1
  const pick = (id: string) => {
    setPicked(true)
    if (id !== prefs.profile.id) void switchProfile(id)
  }
  const covered = !!open || profile || !!playing || !!preshow || asking
  return (
    <LayoutGroup>
      {/* Each layer below is `inert` while covered: hidden screens leave the accessibility tree and Tab order. */}
      <Wall
        sections={sections}
        section={section}
        onSection={setSection}
        openId={open?.id}
        onOpen={openTitle}
        onResume={resume}
        onOpenRail={(item) => openRail(item)}
        onToggleDownload={toggleDownload}
        onProfile={() => setProfile(true)}
        onSearch={() => setSearch(true)}
        onLeaveFullscreen={bigPicture && inputMode === 'keyboard' ? () => void kalli.setBigPicture(false) : undefined}
        active={!covered && !search}
      />
      <AnimatePresence>
        {search && <Search onClose={() => setSearch(false)} onOpen={openTitle} openId={open?.id} active={!covered} />}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <Detail key={open.id} item={open} autoPlay={autoPlay} onClose={() => setOpen(null)} onPlay={(r) => play(r)} active={!profile && !playing && !preshow} />
        )}
      </AnimatePresence>
      <AnimatePresence>{profile && <ProfileMenu onClose={() => (setProfile(false), reloadSections())} />}</AnimatePresence>
      <AnimatePresence>
        {preshow && <PreShow key="preshow" req={preshow} onDone={() => (setPreshow(null), play(preshow, true))} onCancel={() => setPreshow(null)} />}
      </AnimatePresence>
      <AnimatePresence>{playing && <Lights req={playing} onCancel={cancelPlay} />}</AnimatePresence>
      <AnimatePresence>{asking && <WhoIsWatching profiles={prefs.profiles} active={prefs.profile.id} onPick={pick} />}</AnimatePresence>
      <Notice error={error} />
      <Toasts />
    </LayoutGroup>
  )
}
