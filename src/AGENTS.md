# src

## Purpose

All application source, split by Electron process: `main/` (Node, privileged), `preload/` (bridge), `renderer/` (React UI, sandboxed), `shared/` (pure code used by both sides).

## Ownership

- This doc owns `preload/` and `shared/`, and the cross-process contract between main and renderer
- `main/` and `renderer/` have their own docs (see Child DOX Index)

## Local Contracts

- IPC contract has three parts that must change together:
  - `shared/types.ts`: every type crossing the boundary (`Addon`, `Meta`, `Stream`, `Subtitle`, `Settings`, `Profile`, `Profiles`, `PlayerStatus`, `PlayRequest`, `Download`, `Action`, ...)
  - `preload/index.ts`: the `api` object exposed as `window.kalli` via `contextBridge`; its type `Api` is what the renderer sees
  - `main/index.ts`: matching `ipcMain.handle` / `ipcMain.on` channels
- Channel names: plain nouns for reads (`addons`, `meta`, `streams`), `noun:verb` for mutations (`addon:install`, `download:pause`, `settings:set`)
- Main pushes events to the renderer on channels `input`, `download`, `bigpicture`, `player:exit`, `open` (a title picked on a film's end card, sent after `player:exit`), `player:status`, `notify` (a `Notification`, also to the overlay), and to the player overlay `player:view` (and `input` while it is open); preload wraps each as `onX(cb)` returning an unsubscribe function
- The overlay reaches mpv only through `player:do` with a `PlayerCommand` (pause, seek, skip, volume, mute, audio, sub, fullscreen, quit, and three main handles itself: `cinema`, the answer to `PlayerView.cinema`, `sound`, a `SoundMode` from its allowlist, and `open`, which quits and then opens a title's page in the app); main checks the kind and maps each to an mpv command. Never forward raw mpv commands
- `Settings` is machine-wide (GPU, display, cinema mode, CIH projector screen, receiver and `sound` mode, connection, downloads ahead, trailers, pre-show, interface sounds, the room's lights (Hue bridge, user, room; webhook), TMDB key, autostart, `onboarded`, last `volume`); `Profile` is per person (name, accent, `avatar` (an `AVATARS` id or empty for the initial; `profile:set` refuses any other), `Language` preset, `subtitles` on at start (off by default), subtitle look, `autoSkip`, `autoNext`). `profile:set` patches the active profile; watch history (`History`: progress, watched, upNext, dismissed, per-title track choices, end-card ratings) is per profile, downloads are shared
- `PlayRequest.next` names the episode after the one playing; main turns it into `History.upNext` once the episode is watched
- Main applies renderer patches (`settings:set`, `profile:set`) only to fields that already exist, keeping their types
- Every preload method has a renderer caller; delete a channel (preload, handler, types) when its last caller goes
- The renderer never gets Node, filesystem, or raw mpv access; anything privileged goes through a preload method
- `shared/` stays free of Electron, Node, and React imports so both processes and the Node test runner can load it
- `shared/types.ts` follows the Stremio addon protocol shapes; do not rename protocol fields
- `shared/ranking.ts` owns stream parsing (`parseStream`, including Portuguese audio `lang`: `dub`/`dual`/`leg`), quality scoring (`qualityScore`), ranking (`rankStreams`) and the `Verdict` set (`instant`, `tight`, `download`, `p2p`, `uncached`, `unplayable`, `dead`: a link the `bandwidth` check found answering with an error instead of video, via `RankContext.dead`); UI labels for verdicts live in `renderer/src/format.ts`
- Every pick weighs quality, fit (the profile's audio, the resolution cap) and speed: bandwidth is measured per host (`hostOf`), torrents by seeders, and a cópia without a size assumes a typical bitrate for its resolution once its host is measured. `rank` orders streaming, `keep` orders downloads
- Quality weighs resolution first, then source (a remux far above a re-encode), HDR, lossless audio (`TrueHD Atmos`/`TrueHD`/`DTS-HD` over any lossy track; a bare "Atmos" is lossless only on a disc source) and file size as bitrate; the wanted audio language still outweighs a whole resolution step
- `bestAudio` (also in `shared/ranking.ts`) picks the richest audio track within the language mpv chose: lossless, then DD+/DTS, then channels; commentaries and audio description never win, ties keep mpv's pick
- Ranking rules: English "Dual Audio"/MULTi count as Portuguese only with a Portuguese sign (flag, "dublado", "PT-BR"); a `flaw` (3D, hardsub, upscale) sinks a cópia; cache state reads the common `[RD+]`/`[RD download]` and ⚡/⬇️ markers; a torrent streams one resolution step behind a direct link even with a full swarm; ties go to the cached cópia, then the larger swarm
- `shared/after.ts`: `nextPart`, the film after this one in its TMDB collection by release date, only once it is out
- `shared/segments.ts` reads skippable stretches (`recap`, `intro`, `credits`, `post`) from chapter names, else from TheIntroDB (`fromIntroDb`: a gap between two credits spans is the post-credits scene; `videoSegments` picks the source); `creditsStart` (credits chapter, else the last 40 s or 5%) decides both when the next episode is offered and when a video counts as watched

## Work Guidance

- Controllers: `controllers` (in use + paired + whether Bluetooth pairing is available), `controllers:scan`, `controllers:pair`, `controllers:forget`
- Lights: `lights:pair` (finds the Hue bridge, waits for its button, returns its rooms), `lights:rooms`; the rest is `Settings`
- Speed and ambience: `play:warm` (follow a link to its CDN ahead of a press), `trailer` (the local page that plays a title's YouTube trailer, aloud for the pre-show), `pad:rumble` (Play pressed)
- Updates: `update` (an `UpdateStatus`), `update:install`; a ready update is announced with a `notify` of kind `update`
- Skips: `skips` (a video key to TheIntroDB's spans, null when unknown)
- After a film: `after` (the next film of its collection and films like it, TMDB key needed), `history:rate` (👍 / 👎)
- Adding an IPC call: add types in `shared/types.ts`, the method in `preload/index.ts`, the handler in `main/index.ts`; validate renderer-supplied input in main
- Import with explicit `.ts` extensions (`allowImportingTsExtensions`, `verbatimModuleSyntax`); use `import type` for type-only imports

## Verification

- `bun run test` runs `shared/ranking.test.ts`, `shared/segments.test.ts` and `shared/after.test.ts`; add cases there when ranking, parsing, chapter reading or the collection order changes
- `bun run typecheck` catches drift between preload, shared types, and main handlers

## Child DOX Index

- `main/AGENTS.md`: Electron main process
- `renderer/AGENTS.md`: React renderer
