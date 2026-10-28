# src/main

## Purpose

Electron main process: window and tray, IPC handlers, Stremio addon client, mpv provisioning and playback, downloads, P2P torrents, gamepad input, profiles and persisted state.

## Ownership

- `index.ts`: app lifecycle, the restart into X11 on Linux, window (Linux window icon `build/icon.png`), Big Picture mode, tray icon (`build/tray.png`; both `?asset` imports typed by `env.d.ts`), login item, all `ipcMain` handlers (bandwidth cached per host for 10 min, and where each checked link led: `resolved`), routing pad actions to the renderer or, while a video plays, to the overlay; the play flow (fullscreen for the video and back, watched/progress/upNext on exit, the `player:do` allowlist, per-title track choices, cinema mode per session, the lights following each `PlayerView`, downloads ahead stepping aside for a short buffer)
- `overlay.ts`: the player overlay, a transparent frameless window owned by Kalli's, laid over its content bounds and following its moves and fullscreen; loads the renderer at `#player`
- `http.ts`: `getJson`, the one JSON GET helper (native `fetch`, timeout, optional headers, PT-BR error without the URL); `addons.ts` and `tmdb.ts` use it
- `addons.ts`: Stremio addon client (manifest fetch, also used for previews, `supports`, resource URLs, catalog, meta, streams, subtitles, `probe`: a link's speed, or `dead` when it answers with an HTTP error, a web page or a debrid explainer video); `DEFAULTS` (Cinemeta, The Movie Database addon, OpenSubtitles v3) are installed by the `addons` handler whenever none is installed, skipping one that is down
- `mpv.ts`: finds or provisions the player (`ensure`): the installer's `resources/mpv/<BIN>`, then `mpv` on PATH, then `userData/mpv` fetched on first run; reports `PlayerStatus`
- `display.ts`: Windows HDR on/off for the screen Kalli's window is on (`screenOf`, `Screen.hdr`, `setHdr`, the DisplayConfig advanced-color state through PowerShell); never on Linux, where mpv under XWayland can't send HDR. The refresh rate is never touched
- `lights.ts`: the room follows the film (`scene`: play dims to dark, pause to a glow, credits and stop back to how it was): Philips Hue through the bridge's local v1 API (`pair` finds it via Philips' discovery service and waits for its button, `rooms`), and any other system through `Settings.lightsWebhook` (a JSON POST per moment)
- `trailer.ts`: the page the local server serves at `/trailer/<id>`: a muted YouTube embed that tells its parent when it truly plays or ends
- `mpv-fetch.ts`: where mpv comes from (`source`: Windows zhongfly's mpv-winbuild 7z, Linux pkgforge-dev's FUSE-free AppImage), `latest` release asset, `download` sha256-checked against GitHub's asset digest, `place` into a folder as `BIN` (`mpv.exe` unpacked with `7z-wasm`, or `mpv.AppImage` made executable); shared by `mpv.ts` and `scripts/fetch-mpv.ts`
- `player.ts`: spawns mpv into Kalli's window (`--wid`) with its own OSC, OSD and bindings off, builds its args from `Settings` (Máxima image = `high-quality` profile plus debanding; CIH keeps the video and subtitles inside the 2.39:1 band through top and bottom margins) and the active `Profile` (language preset, subtitles on or off, subtitle look, volume) plus the title's hand-picked tracks, switches to the richest audio track in the chosen language once the file opens (`bestAudio`), shapes decoded audio by `Settings.sound` (`setSound`: downmix centre lift plus a compressor, never on bitstreamed audio), fades the sound up from silence once the picture moves and down before a quit (`ramp`; `PlayerView.volume` and the saved volume stay the person's), talks to it over JSON IPC, pushes a `PlayerView` (time four times a second, anything else at once), runs `PlayerCommand`s (`apply`), adds online subtitles once the track list arrives, reports the final state (position, duration, chapters, volume, error) on exit, detects GPU hardware codecs
- `downloads.ts`: direct-link downloads into the library, resume after restart, `remove` (stops it, deletes its file, or a torrent's own folder, only inside the library), downloads ahead (`ahead`: refused below 60 GB free, never touching an existing download; `holdAhead` pauses and resumes them), and a local HTTP server (`127.0.0.1`) so mpv can play a download while it arrives, which also serves the trailer page
- `torrents.ts`: WebTorrent streaming and downloading of P2P cópias; `webtorrent.d.ts` declares the few untyped shapes used
- `bluetooth.ts`: Bluetooth controllers without Windows Settings, through Windows' pairing API (WinRT) in a hidden PowerShell: `paired` (fast, device cache), `scan` (about 30 s), `pair`, `forget`; keeps only controllers (device class joystick/gamepad, or a controller-like name), one per device across adapters
- `gamepad.ts`: reads controllers through SDL (`@kmamal/sdl`) and maps them to `Action`s, with held-direction repeat; notifies a controller connected later, disconnected, or with a low battery (once per level); `rumble` (a thump on Play, a double pulse as a video's picture starts, a soft buzz with its credits), only while a pad was pressed in the last 10 min
- `store.ts`: single persisted `state` (addons, settings, profiles, active profile, history by profile, downloads) in `userData/state.json`; `activeProfile()`, `history()`, `newProfile()`; `downloadDir()`; adoption of the pre-rename (`kaleidescape-de-pobre`) state and library folder
- `updater.ts`: Kalli's own updates through `electron-updater` from the GitHub releases in `package.json` `build.publish`: checks at start and every 6 h, downloads only while no video plays (`hold`, called by `startPlay` and `endPlayback`, cancels and resumes), notifies once when ready, installs on quit (Windows, AppImage) or through `update:install` (a .deb only this way: pkexec asks for a password); does nothing unpackaged
- `tmdb.ts`: optional PT-BR localization of titles, synopses, episode names through TMDB; `after`, a film's next in its collection and its recommendations as IMDb ids (the end card, the pre-show's reel)

## Local Contracts

- mpv IPC can run programs: the renderer has no raw mpv channel. The overlay's `player:do` is an allowlist (`COMMANDS` in `index.ts`), each kind mapped to one mpv command in `player.apply`; a new playback control adds a `PlayerCommand` kind there, never a passthrough
- mpv draws into Kalli's own window, which needs `disable-direct-composition` (with DirectComposition Chromium's surface covers child windows and the video is only heard). The overlay is a separate owned window above it; only it receives input while a video plays
- A new video started from the overlay (next episode) replaces mpv while the overlay stays: the old process's exit saves its history but does not close the overlay or send `player:exit` when `player.isPlaying()` is already true again. Each mpv gets its own IPC endpoint (`ipcPath`, numbered per spawn): the dying one still holds, and on Linux unlinks, its own
- A video is watched past 95% or once `creditsStart` is reached (chapters, else TheIntroDB's credits); then `PlayRequest.next` becomes the title's `upNext`
- Resuming starts 10 s before the saved position, 30 s when it was saved more than a day ago
- The end card's `after` never offers a watched or disliked (-1) film, nor the recommendations of a disliked one; `open` from the overlay is validated (string id and type) and sent to the app only after `player:exit`
- `download:remove` refuses the download that is playing; a removed download's late job reports are dropped (`changed` checks it is still the one in `state.downloads`)
- Notifications go through `notify` in `index.ts` to the app and the overlay: downloads starting, finishing or failing (never a pause), controllers, and a cópia that failed and was replaced
- A play that fails before playback moves (mpv exit code, e.g. 2) starts `PlayRequest.fallbacks[0]` in its place with the rest as its fallbacks; fallbacks are never saved with progress or downloads
- `store.save()` writes tmp + rename; keep it atomic, installed addon URLs can carry debrid keys
- `store.load()` merges saved settings over `SETTINGS`; new settings need a default there, new profile fields one in `newProfile()`
- State saved before profiles (top-level `progress`/`watched`, `audioLangs`/`subLangs`/`mpvPath` settings) loads as one profile, "Casa", holding that history; with addons installed it counts as onboarded
- `mpv-fetch.ts` imports no Electron: the build runs it under plain Node
- Cinema mode (`Settings.cinema`, on by default) is decided once per session, a session being everything until the player closes (`endPlayback`): the first video starts paused (`hold`); when its first frame is PQ or HLG and the display can do HDR but isn't, Windows HDR turns on and the overlay asks (`PlayerView.cinema`); A keeps it, B or 15 s of silence goes back. Next episodes inherit the decision; `state.display.hdrOff` says to turn it back off, and mpv re-reads the display's colour space after each HDR change (`player.displayChanged`)
- Downloads ahead: the overlay asks for the next episode's best `keep` cópia once the playing one has 90 s buffered; main pauses them while the video's buffer is under 30 s (resumes above 90 s, and when playback ends), never notifies about them, and deletes one once its episode is watched
- The lights never block or delay anything: every Hue and webhook call is fire-and-forget with a 5 s timeout, one at a time in order; a room that was dark before the film is left alone. The Hue user is a secret like debrid keys (kept in `state.json`)
- A link the bandwidth check (or `play:warm`, from Continuar's focused tile) followed to another address is played from that address for 10 min; headers still go with it. Downloads and saved progress keep the addon's own link
- The trailer page only takes an 11-character YouTube id (`isTrailerId`) and is served behind the same Host check as downloads
- The replaced HDR state is saved in `state.display` before switching and put back when the session ends, before a quit, and at the next start after a crash; it is forgotten only once restored. The display scripts follow the Bluetooth rule: fixed text, inputs in environment variables
- Packages the main process loads at runtime (`7z-wasm`, `webtorrent`, `@kmamal/sdl`) are `dependencies` and are imported lazily; native ones load from `app.asar.unpacked` in the installed app
- A play waits for `mpv.ensure()` (the title card shows install progress); history is written to the profile that pressed play
- The mpv AppImage is spawned with `DISABLE_AUTO_UPDATES=1`, or it asks mid-film to check for its own updates
- Linux runs under X11 (XWayland): `--wid` needs an X11 window id and the overlay is placed by position, neither exists on Wayland. Electron reads `--ozone-platform` before `index.ts` runs, so an instance that came up on Wayland spawns itself again with `--ozone-platform=x11` (an AppImage through `$APPIMAGE`, not `app.relaunch`, whose helper lives in the dying mount) and exits before taking the single-instance lock. mpv is spawned without `WAYLAND_DISPLAY` so it picks X11 and honours `--wid`
- Subtitles start off unless the title's own pick or the profile (`subtitles`) turns them on; off still lets mpv show forced tracks
- Online subtitles go to mpv only as `https` URLs via `sub-add`; one is selected only when subtitles are on and no file track (or the audio) is already in the wanted language
- First start after the rename copies `appData/kaleidescape-de-pobre/state.json` into the new `userData` when none exists there; the old file is never touched
- `downloadDir()` keeps `<Videos>/kaleidescape-de-pobre` when it exists (downloads store absolute paths, torrents reopen from the folder), else `<Videos>/Kalli`
- Linux autostart writes `kalli.desktop` (pointing at `$APPIMAGE` when running from one) and removes the old `kaleidescape-de-pobre.desktop`
- TMDB receives only the IMDb id; TheIntroDB (`skips`, cached per video key, read by the lights and the watched mark too) only the IMDb id with season and episode
- The local media server binds to `127.0.0.1` only
- Gamepad loading fails soft: if SDL cannot load, log `gamepad disabled` and continue with keyboard input
- The Bluetooth script is one fixed text sent with `-EncodedCommand`; its inputs travel in environment variables, never in the script, and `pair`/`forget` only accept ids that `paired`/`scan` listed
- Automatic pairing (`autoPair` in `index.ts`) runs only at start with no controller in use and none paired: up to four searches, pairing the first controller found. A Bluetooth search can make wireless headphones stutter, so nothing searches once a controller is paired
- An update never touches the film: no check or download while `player.isPlaying()`, and `update:install` refuses while a video plays and sets `quitting` so the window closes instead of hiding to the tray
- Login autostart stays off unless the user enables it in Perfil → Preferências
- Closing the window quits (`quitApp`: a playing video is quit cleanly first so its position saves, then the app quits). It hides to the tray only while a download is running or with `Settings.closeToTray`, and then always stops the video and shows a system notification (`trayNotice`); tray → Sair goes through `quitApp` too
- Option names passed to mpv must exist in current mpv builds: an unknown option makes mpv exit before playing

## Work Guidance

- Simplifications with a known ceiling are marked `ponytail:` with the upgrade path; keep that convention
- HTTP is native `fetch`; JSON GETs go through `getJson`. No axios or other HTTP client: the bandwidth probe, downloads and the local media proxy stream web `ReadableStream` bodies from `fetch`

## Verification

- `bun run typecheck`
- `bun dev`: watch the main-process console; a clean start prints `starting electron app...` with no `gamepad disabled` warning
- Playback: play something and check the picture shows under the overlay's controls (not just its sound), windowed and fullscreen

## Child DOX Index

None.
