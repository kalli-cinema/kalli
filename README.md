<p align="center"><img src="brand/kalli-logo.png" alt="Kalli" width="420" /></p>

# Kalli

A 10-foot movie wall for the TV, on top of Stremio-protocol addons, played through mpv (shipped in the installers, fetched by the app on first run otherwise).

## Run on Windows (desktop)

1. Install [Node.js](https://nodejs.org) 22.12 or newer. Nothing else: the player (mpv) is fetched on first run when the system has none.
2. In this folder:

   ```
   npm install
   npm run dev
   ```

3. Turn off Xbox Game Bar's controller shortcut (Settings → Gaming → Xbox Game Bar), or the Xbox button opens Game Bar instead of Big Picture.

First run shows *Bem-vindo*: create your profile (name, picture, colour), check the sources that come installed (Cinemeta, The Movie Database, OpenSubtitles) or add another addon by link, while the player downloads (about 30 MB). Everything else lives in **Perfil** (Menu): profiles, video, preferences, language and subtitles, accent colour, controllers (Bluetooth pairing without Windows Settings), downloads, and addons (add any Stremio addon by its `manifest.json` URL, previewed before it is added).

Nothing starts with Windows unless you turn on Perfil → Preferências → *Ao ligar o computador → Esperar na bandeja*. Closing the window quits Kalli (a playing video saves its position first); it stays in the tray, with a notification, only while downloads run or with *Ao fechar a janela → Continuar na bandeja*.

## Build the Windows installer

With [bun](https://bun.sh), in this folder:

```
bun install
bun run dist
```

This fetches the latest mpv build into `resources/mpv` (sha256-checked), builds the app and writes `dist/Kalli-Setup-<version>.exe`: a one-click, per-user installer (no admin) that ships mpv, so the installed app never downloads a player. The installer is unsigned, so SmartScreen asks once (*Mais informações → Executar assim mesmo*).

## Releases and updates

Bump `version` in `package.json` and push to `main`: GitHub Actions ([release.yml](.github/workflows/release.yml)) builds the Windows installer, the AppImage and the .deb, and publishes them as release `v<version>`. Installed copies check that release every 6 hours, download it in the background (never while a video plays) and install it when Kalli closes, or right away from Perfil → Preferências. A .deb asks for the computer's password, so it installs only from there.

## Run on Linux

Same as Windows, with [bun](https://bun.sh): `bun install`, then `bun dev`. Kalli runs under X11 (XWayland on a Wayland desktop) because mpv draws inside its window; the dev script and the packaged app take care of it. On Ubuntu 24.04+ the dev Electron starts without Chromium's sandbox, which those systems block for unprivileged apps.

## Build the Linux packages

`bun run dist` on Linux writes `dist/Kalli-<version>.AppImage` (`chmod +x` and run it; no libfuse2 needed) and `dist/kalli_<version>_amd64.deb` (`sudo apt install ./dist/kalli_<version>_amd64.deb`). Both ship mpv as an AppImage. Builds are per platform: run `bun run dist` on the system you are packaging for.

## Controls

One meaning per button everywhere: **A** does the main thing, **B** goes back, **X** downloads, **Y** shows more.

| Pad | Keyboard | Wall | Entry | Playing |
| --- | --- | --- | --- | --- |
| D-pad / stick | Arrows | Move (↑ from the top row: Continuar) | Episodes | Controls hidden: ←/→ ±5 s, ↑/↓ show them. Shown: move between controls |
| A | Enter | Open | Watch (pressed early, it waits for the best cópia) | Pause, or the focused control; takes "Pular abertura" and the next-episode card |
| B | Esc | Keyboard in fullscreen: back to a window | Back | Stop (saves position); on the credits card, stay for the credits |
| X | D (or X) | Continuar: pause a download, or remove the title | Download / pause | Episodes (series) |
| Y | I (or Y) | More about this title | Ver cópias, full synopsis | Áudio e legendas |
| LB / RB | Q / E | Section | Season | Chapter (±60 s without chapters) |
| LT / RT | PgUp / PgDn | Page | — | Volume, up to 200% (also + / −, the wheel over the slider, or dragging it; past 100% turns red) |
| Menu | M | Perfil | — | Show controls |
| View | / | Search | — | Fullscreen (also F / F11) |
| Guide | F11 | Big Picture on/off | | |

While a video plays the mouse works too: a click pauses, a double click toggles fullscreen, the timeline seeks.

In Perfil: Up/Down moves, A opens or acts, Left/Right chooses, LB/RB (Q/E) jumps a section, B goes back. In Search and in Perfil fields, B erases (and leaves once the field is empty); Menu saves a field.

## Checks

```
npm test          # stream ranking, chapter segments
npm run typecheck
npm run build
bun run dist      # installer for this platform
```

## Content and responsibility

Kalli is a player and organizer. It hosts, indexes, links to and suggests no films, series or streams, and ships with no content sources. Out of the box it installs only metadata and subtitle addons (Cinemeta, The Movie Database addon, OpenSubtitles v3). Anything that plays comes from addons the user chooses to install, and each user is responsible for making sure the addons they install and the content they watch are legal where they live.

Kalli is an independent project, not affiliated with or endorsed by Stremio, mpv, TMDB or any other product it works with.

## Credits

- This product uses the TMDB API but is not endorsed or certified by TMDB. Titles, synopses and images come from [The Movie Database](https://www.themoviedb.org) when a TMDB key is set.
- Playback by [mpv](https://mpv.io) (GPL-2.0-or-later / LGPL-2.1-or-later), downloaded as a separate program; installers ship its unmodified Windows or Linux build, whose source is at [mpv-player/mpv](https://github.com/mpv-player/mpv).
- Skippable openings and credits from [TheIntroDB](https://theintrodb.org) community timestamps.

## License

Kalli's code is [MIT](LICENSE). The Kalli name, mark and logos in `brand/` identify this project: forks should use their own. Third-party components keep their own licenses.
