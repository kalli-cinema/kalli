# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron desktop app; the interface is a Chromium renderer shown full-screen on a TV, monitor or projector.)

## Stack

Electron 44 + React 19 + Motion 14, built with electron-vite. Chosen by the user after comparing Electron and Tauri: Tauri's WebKitGTK on Linux animates poorly and has unreliable Gamepad API support. Video never plays in the webview: mpv runs as a separate process drawing into Kalli's window (`--wid`), under a transparent overlay window with the app's own controls, controlled over JSON IPC (`gpu-next`, VAAPI/D3D11VA, HDR passthrough or libplacebo tone-mapping, optional bitstream audio).

## Users

A household watching together from the couch: one shared library and catalog, and a profile per person with their own watch progress, language and accent colour. They use a gamepad as the remote and sit at TV distance, often in a dark room with a projector. The app must be plug and play: install it, pick addons, watch, with nothing else to install or configure.

## Product Purpose

Kalli brings the browsing ritual and reference-grade playback of a high-end home-cinema server to an ordinary PC, fed by the Stremio-protocol addons the household chooses. Success means picking something to watch feels like a ritual rather than a scroll, and pressing play delivers the best picture and sound the connection and hardware can actually sustain, without the user comparing stream lists.

## Positioning

Stremio and Nuvio aggregate streams but leave the user sorting cryptic stream names; high-end cinema servers curate quality but cost thousands and own the catalog. This product does both: it runs any Stremio addon and decides for the user, ranking streams by resolution, HDR/Dolby Vision, source (REMUX first), lossless audio, the profile's preferred audio (dubbed, dual or original), the source's cache state, bandwidth measured on each stream's own server, swarm health and the GPU's hardware decoders, then streams or downloads accordingly.

## Operating Context

- Two machines: a VAIO notebook (Ryzen 7 5700U, Vega 8, Ubuntu 26.04 GNOME Wayland; internal SDR panel and a Samsung 24" over HDMI) and a desktop (Xeon + RX 7600, Windows).
- Outputs: laptop/SDR monitor, HDR TV over HDMI, a projector, and an AVR/soundbar for Atmos.
- Streams arrive as direct HTTPS links or P2P torrents, from whatever addons the household installs; Kalli hosts, indexes and suggests no content.
- Input: gamepad first (D-pad/stick, A/B/X/Y, shoulders), keyboard as a fallback. No mouse assumed.

## Capabilities and Constraints

- First run (Bem-vindo) is three steps while the player (mpv) is fetched in the background: Criar perfil (name, one of six preset pictures or the initial, accent colour), Fontes (Cinemeta, The Movie Database and OpenSubtitles come installed and can be unticked; any other Stremio addon by link) and Pronto. Kalli suggests no other addons.
- Any Stremio addon by manifest URL, previewed (name, what it brings, new sections) before it is added. Catalog (including search), meta, stream and subtitles resources are supported; online subtitles (OpenSubtitles v3) are offered in the profile's subtitle language and switched on only when the profile has subtitles on and the file has none.
- Perfil (Menu) is the one place for choices, a full-page game-style menu: profiles, video (image quality, smooth motion, cinema mode, resolution cap), preferences (TMDB key, autostart, close to tray, next episode ahead, trailers, interface sounds, player status), language and subtitles (audio preset, subtitles on or off at start, off by default, subtitle size, colour and background, receiver passthrough, sound mode), lights (Hue bridge and room, or a webhook), appearance (accent colour) and addons.
- Movies and series, with season/episode browsing that opens on the episode in progress.
- Stream verdicts: instant, tight, download (bitrate exceeds bandwidth), p2p, uncached (the source hasn't prepared it yet), unplayable, dead (the link answers with an error, checked before play).
- A cópia that won't open is replaced by the next best one on its own, with a notification; dead links never become the pick.
- Notifications slide in at the bottom right (top right while a video plays): downloads starting, finishing or failing, controllers connecting or disconnecting, low controller battery.
- Perfil → Controles shows the controllers in use (with battery) and the ones paired by Bluetooth, and searches for and pairs new ones without Windows Settings; on a first start with none at all, Kalli searches by itself for two minutes and pairs the first controller held in pairing mode.
- Perfil → Downloads lists every download with its progress; A pauses or resumes, X deletes it (file included) after a second X.
- Stream or download, for direct links and P2P torrents alike; a download can be watched while it is still arriving.
- Optional TMDB key for PT-BR titles, synopses and episode names (only the IMDb id is sent).
- Resume position is saved per title and per profile when playback exits, and playback picks up 10 s before it (30 s after a day or more); a video counts as watched once its credits roll.
- A film's credits bring an end card (with a TMDB key): the next film of its collection, which A starts with its best cópia and never by itself, three films like it, whose page A opens, and a 👍 / 👎 that keeps a disliked film, and what it suggests, out of later cards.
- Pre-show (Perfil → Preferências, off by default): two trailers with sound before a film started from its beginning; A goes straight to the film.
- The picture rises out of black with the sound fading up, and leaving fades both out; the pad rumbles under Play, as the picture starts and when the credits roll.
- A cover resting on the wall gets its cópias fetched and its pick checked, so its page opens with Assistir ready; the wall comes up at launch with last time's titles while the addons answer.
- "Quem vai assistir?" at launch in a house with two or more profiles.
- Projector constant-height (CIH, Perfil → Vídeo): the interface and every film stay inside a 2.39:1 screen's band.
- The player has its own controls over the picture (title, timeline with chapters, play, ±5 s, next episode, volume, áudio e legendas, episodes, fullscreen), driven by pad, keyboard or mouse.
- Openings, recaps and credits get a skip button (or skip themselves, per profile), marked by the file's chapters or, without named chapters, by TheIntroDB's community timestamps; a movie's credits jump to a post-credits scene when there is one, and its end card waits until that scene has played.
- In a series' credits the next episode is offered with a 10 s countdown and starts with its best cópia; after three in a row with no one touching the controls it waits.
- An audio or subtitle track picked by hand is remembered for the rest of that series.
- Cinema mode: at the start of a film or a run of episodes Windows turns HDR on for an HDR film (the refresh rate is never touched), the first frame waiting under a question; kept for the whole session only when confirmed within 15 s, and put back when the player closes.
- A cinema server keeps films local; Kalli downloads the next episode, at the best quality, while the current one plays (it steps aside whenever the video needs the connection) and deletes it once watched.
- The room follows the film: Hue lights (or anything behind a webhook) dim on play, glow on pause and come back with the credits.
- Sound for the room: Original, Diálogos claros (voices lifted, effects tamed) or Noturno (one level for everything), switchable in the player; never applied to audio bitstreamed to a receiver.
- The interface clicks softly under the pad and a warm chord plays as a film starts; a title's page lets a muted trailer fade in behind it after a few seconds.
- Starting is fast: a link checked on the title page (or the focused Continuar tile) is opened straight at its CDN, and cinema mode's screen check runs while the file opens.
- The richest audio track in the chosen language plays: lossless TrueHD or DTS-HD MA over the lossy copy discs carry beside it.
- Continuar shows the episode in progress, the next episode once one is finished, and downloads; any title can be removed from it.
- The app starts at login only if the user turns that on; the household's work machine is never interrupted by default.
- The renderer must hold 60 fps on a Vega 8 iGPU at 1080p and on an RX 7600 at 4K.
- Kalli updates itself from its GitHub releases: downloaded in the background only while no video plays, installed when the app closes (or at once from Perfil → Preferências; a .deb only there, since it asks for a password).
- Windows: one installer file (one click, per user, no admin) that ships mpv, so the first run never waits for a player download.

## Brand Commitments

Kalli is its own brand (mark, wordmark and avatars by `scripts/brand.py`; line "Sua sala de cinema"). The experience is a cinema server's: a cover-art wall that wraps endlessly in every direction, the backdrop-led detail page and collections. Never use another product's name, trademarks or artwork in the app, the brand or public docs.

## Evidence on Hand

Brand assets (the mark, logo, icons, preset avatars) are generated by `scripts/brand.py`. All other imagery (posters, backdrops, logos) comes at runtime from addon metadata (Cinemeta/metahub). No reviews, ratings, or editorial copy beyond what addons return; do not fabricate any.

## Product Principles

1. The machine chooses; the person watches. One button plays the best stream, and every alternative is explained in plain words.
2. Cinema first: artwork and the film lead every screen, and chrome recedes.
3. Ten feet, one hand: every action is reachable with a gamepad, and focus is always visible and predictable.
4. Honest about quality: say exactly what will play (4K Dolby Vision REMUX, Atmos) and why something can't play instantly.
5. Never wait without a reason: show progress, bandwidth and next steps instead of spinners.

## Accessibility & Inclusion

Viewed at 10-foot distance: large type, high-contrast focus, no information carried by color alone, and no hover-only affordances. Respect `prefers-reduced-motion`. All UI copy is in Brazilian Portuguese (PT-BR).
