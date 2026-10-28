# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index
- Each parent explains what its direct children cover and what stays owned by the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user instructions; if there are no specific standards or instructions yet, leave it empty
- Verification must reflect an existing check; if no verification framework exists yet, leave it empty and update it when one exists

Default section order:
- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md

- File and folder names are kebab-case (`rail-tile.tsx`, `use-streams.ts`); identifiers keep their language's case (`RailTile`, `useStreams`)
- Plug and play: install, pick addons, watch. Nothing for the user to install by hand (mpv is provisioned by the app); no "Ajustes" screen: everything configurable lives in Perfil, a full-page, game-style menu
- Every play picks by best quality, the profile's preferred audio, and download/stream speed
- Quality is the product: a reference home-cinema server is the bar (remux picture, lossless audio); prefer the higher-fidelity cópia, track and render path whenever it can still play
- Subtitles start off by default (forced ones still show); a profile turns them on in Perfil → Idioma e legendas
- Cinema mode changes the screen only with a confirmation that reverts by itself in 15 s, once per session (never per episode), and the original mode always comes back
- Never change the monitor's refresh rate (Hz); cinema mode only switches Windows HDR
- First run is three steps: Criar perfil (name, preset picture, colour), Fontes (Cinemeta, The Movie Database and OpenSubtitles come installed; more only by link), Pronto. The app never suggests or preinstalls third-party stream addons
- Brand line is "Sua sala de cinema", nothing more: the brand leads with the film and the room, never the gamepad
- Aim every feature at luxury and "juice" (picture, sound, light, motion, speed), but nothing ambient may get in the way of the film: lights, trailers, sounds and downloads ahead fail silent and step aside

## Project

- Kalli (display name; `kalli` in identifiers; an earlier private build used another folder name, adopted by `src/main/store.ts`): 10-foot, gamepad-first movie UI on top of Stremio-protocol addons; video plays in an external mpv process, never in the webview
- Stack: Electron 44, React 19, Motion 14, Tailwind CSS 4 (`@tailwindcss/vite`), coss UI components (Base UI), lucide-react icons, TypeScript (strict, `.ts` import extensions), built with electron-vite (`electron.vite.config.ts`), packaged by electron-builder (Windows NSIS; Linux AppImage and deb; x64); `7z-wasm` unpacks mpv on Windows
- All UI copy is Brazilian Portuguese (PT-BR); code, comments and docs are English

## Root Ownership

- `PRODUCT.md`: product purpose, users, operating context, capabilities, principles; source of truth for what the app must do
- `DESIGN.md`: visual design system (frontmatter tokens + prose rules); source of truth for how the UI looks; tokens mirror `src/renderer/src/styles.css`
- `README.md`: setup on Windows, controls table, check commands, the content-responsibility notice, credits (TMDB attribution, mpv, TheIntroDB) and license summary; keep the notice and credits whenever defaults, sources or third-party services change
- `LICENSE`: MIT for the code; the Kalli name and brand marks are not licensed for forks (README)
- `package.json`, `tsconfig.json`, `electron.vite.config.ts`: build and toolchain config; the `@/*` path alias (tsconfig `paths`, vite `resolve.alias`) points at `src/renderer/src` and exists for the generated coss files; the `build` key in `package.json` is the electron-builder config (app `out/**`, `@kmamal/sdl` unpacked from the asar, `resources/mpv` shipped as `resources/mpv`, no native rebuild, AppImage on the static runtime toolset `toolsets.appimage` so it needs no libfuse2); on Linux `electron.vite.config.ts` sets `NO_SANDBOX` when unprivileged user namespaces are blocked (Ubuntu 24.04+), the same probe the AppImage launcher runs (the .deb installs an AppArmor profile instead)
- `scripts/brand.py` (+ `scripts/requirements.txt`: fonttools[woff], pillow, resvg-py): draws the brand as SVG and rasterizes it; the only source of the mark, logo lockups, app/tray icons and preset avatars. Never hand-edit its outputs: `build/icon.png`, `build/icon.ico` (electron-builder's icon, found by default in `build/`), `build/tray.png`, `brand/` (logos, app icon, avatar contact sheet), `brand/social/` (the social kit: profile picture, posts, story, link preview, GitHub, X and YouTube headers; sizes in `SOCIAL`), `src/renderer/src/assets/brand/`, `src/renderer/src/assets/avatars/`
- `scripts/fetch-mpv.ts`: build step of `bun run dist`; fetches the latest mpv for the host platform into `resources/mpv` (`mpv.exe` unpacked, or `mpv.AppImage`) through `src/main/mpv-fetch.ts`
- `resources/mpv/` (gitignored): mpv fetched for the installers; `dist/` (gitignored): electron-builder output (`win-unpacked/`, `Kalli-Setup-<version>.exe`, `latest.yml`; `linux-unpacked/`, `Kalli-<version>.AppImage`, `kalli_<version>_amd64.deb`, `latest-linux.yml`)
- `.github/workflows/release.yml`: releases. Every push to `main` whose `package.json` version has no GitHub release yet builds on `ubuntu-22.04` and `windows-latest` and publishes release `v<version>` with the installers, blockmaps and `latest*.yml`; "Run workflow" builds without publishing
- `components.json`: shadcn CLI config that installs coss components (`@coss` registry) into `src/renderer/src/components/ui`
- `out/`: electron-vite build output; generated, never edit by hand
- `.impeccable/` (gitignored): local design-tool state

## Workflow Rules

- Package manager in use: bun (`bun.lock`); `package-lock.json` also exists from npm
- bun blocks dependency lifecycle scripts by default; a dependency that downloads a native binary on install must be listed in `package.json` `trustedDependencies` (currently `@kmamal/sdl`, and `node-datachannel`, the WebRTC binary WebTorrent cannot load without)
- `dependencies` is what the main process loads at runtime and is all that ships in `app.asar`; renderer-only packages (React, Motion, Base UI, lucide, fonts, class helpers) are `devDependencies` because vite bundles them
- If `bun dev` fails with `Error: Electron uninstall`, the Electron binary download did not finish: run `node node_modules/electron/install.js`
- mpv: the installers ship `resources/mpv/mpv.exe` or `resources/mpv/mpv.AppImage`; otherwise a system `mpv` on `PATH` is used, or the first run downloads one into `userData/mpv` (see `src/main/AGENTS.md`)
- Installers: `bun run dist` = `scripts/fetch-mpv.ts`, `electron-vite build`, `electron-builder` for the host platform (no cross builds: native deps in `node_modules` are the host's); unsigned, icon from `build/`
- Shipping: bump `version` in `package.json` and push to `main`; CI publishes the release and installed copies update themselves (`src/main/updater.ts`). `build.publish` (GitHub `kalli-cinema/kalli`, public) is where they look; never rename installer files after the build (`latest*.yml` names them), never set or change `appId` (the installed NSIS identity follows it), and keep the repository public (updates read its releases without a token)
- Linux runs under X11 (XWayland): `dev` and `start` pass `--ozone-platform=x11`; a packaged app started on Wayland restarts itself with it (see `src/main/AGENTS.md`)
- To try the app without touching your real data, run the built app with its own folder: `electron . --user-data-dir=<folder>` (it still adopts the legacy state into that folder)
- Brand assets: `pip install -r scripts/requirements.txt` then `python scripts/brand.py` from the root (reads Archivo from `node_modules`, so `bun install` first); review `brand/avatars-sheet.png` after changing an avatar. A new avatar id goes in `brand.py` `AVATARS`, `AVATARS` in `src/shared/types.ts` and `src/renderer/src/avatars.ts`
- Add a coss component with `bunx --bun shadcn@latest add @coss/<name>`; check its runtime deps landed in `package.json` `devDependencies` (the CLI skips them without `init`)
- The app name drives Electron's `userData` folder and the default library folder; renaming it again needs the legacy adoption in `src/main/store.ts`

## Verification

- `bun run test`: Node test runner on `src/shared/*.test.ts` (stream ranking, audio language, per-host speed, audio track pick, chapter segments, next film of a collection)
- `bun run typecheck`: `tsc --noEmit`
- `bun run build`: electron-vite production build
- `python scripts/brand.py`: regenerates every brand asset without errors
- `bun dev`: launches the app; check the console for `gamepad disabled` or main-process errors
- `bun run dist`: produces `dist/Kalli-Setup-<version>.exe` and `dist/latest.yml` on Windows, `dist/Kalli-<version>.AppImage` and `dist/kalli_<version>_amd64.deb` on Linux; install it (`/S` for silent) or run the AppImage, launch with `--user-data-dir=<empty folder>`: Bem-vindo shows "Player de vídeo: Pronto" and no `mpv` folder appears in that user data

## Child DOX Index

- `src/AGENTS.md`: all application source; Electron process boundaries, IPC contract, shared types and stream ranking, preload bridge
  - `src/main/AGENTS.md`: main process (addons, mpv provisioning and player, downloads, torrents, gamepad, profiles and persisted state, TMDB)
  - `src/renderer/AGENTS.md`: React UI (screens, welcome, profile menu, input focus model, motion, styles)