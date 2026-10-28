import { Gamepad2, HardDriveDownload, Lamp, Languages, MonitorPlay, Palette, Puzzle, SlidersHorizontal, Users, type LucideIcon } from 'lucide-react'
import type { Addon, AvatarId, BtDevice, Controllers, Download, Language, LightRoom, PlayerStatus, Profile, Settings, UpdateStatus } from '../../../shared/types.ts'
import { refreshLibrary } from '../data.ts'
import { downloadStatus } from '../format.ts'
import type { Pos } from '../keyboard.ts'
import { addProfile, reloadSettings, removeProfile, setProfile, setSettings, switchProfile, type Prefs } from '../prefs.ts'
import { AVATAR_ART } from '../avatars.ts'
import { ACCENTS } from './accents.ts'

const kalli = window.kalli

type Base = {
  id: string
  label: string
  note?: string
  /** Heading shown above this row: it starts a group. */
  group?: string
}

/** Left/Right walks the options. */
/** `swatches` puts a colour beside each option, `images` a picture (empty for none). */
export type ChoiceRow = Base & { kind: 'choice'; options: string[]; at: number; swatches?: string[]; images?: string[]; pick: (i: number) => unknown }
/** A opens the field editor; `keys` picks the on-screen keyboard (URLs, or names with spaces and accents). */
export type TextRow = Base & { kind: 'text'; value: string; placeholder: string; secret?: boolean; keys: 'url' | 'name'; save: (v: string) => Promise<unknown> }
/** A runs it; with `confirm`, only on the second A. An `isAddon` row shows the addon (`addon` is missing while its manifest loads). */
export type ActionRow = Base & {
  kind: 'action'
  tag?: string
  confirm?: string
  profile?: Profile
  isAddon?: boolean
  addon?: Addon
  run: () => unknown
  /** A meter under the row (a download's progress), 0–1. */
  progress?: number
  /** X does this, after a second X when `confirm` says why (deleting a download). */
  secondary?: { tag: string; confirm: string; run: () => unknown }
}
export type Row = ChoiceRow | TextRow | ActionRow

/** The text field being typed into, with its own keyboard position and shift state. */
export type Editor = { row: TextRow; draft: string; pos: Pos; upper: boolean }

export type MenuCtx = {
  prefs: Prefs
  addons: Addon[]
  player: PlayerStatus
  /** Kalli's own update; null while loading or in `bun dev`. */
  update: UpdateStatus | null
  downloads: Download[]
  /** Null while loading. */
  controllers: Controllers | null
  /** Controllers found by the last search; null before any. */
  found: BtDevice[] | null
  /** The paired Hue bridge's rooms. */
  rooms: LightRoom[]
  setControllers: (c: Controllers) => void
  setFound: (f: BtDevice[] | null) => void
  setRooms: (r: LightRoom[]) => void
  setAddons: (a: Addon[]) => void
  /** Opens the manifest preview before installing. */
  preview: (a: Addon) => void
}

export type Section = { id: string; label: string; sub: string; icon: LucideIcon; rows: (c: MenuCtx) => Row[] }

function choice<T>(r: Base & { value: T; options: [T, string][]; set: (v: T) => unknown; swatches?: string[]; images?: string[] }): ChoiceRow {
  const { value, options, set, ...base } = r
  const at = Math.max(0, options.findIndex(([v]) => v === value))
  return { ...base, kind: 'choice', options: options.map(([, l]) => l), at, pick: (i) => set(options[i][0]) }
}

const setting =
  <K extends keyof Settings>(k: K) =>
  (v: Settings[K]) =>
    setSettings({ [k]: v })
const own =
  <K extends keyof Profile>(k: K) =>
  (v: Profile[K]) =>
    setProfile({ [k]: v })

const LANGUAGE_NOTE: Record<Language, string> = {
  dub: 'Prefere cópias dubladas ou dual áudio. Com legendas ligadas, elas aparecem em português só quando não houver dublagem.',
  'original-pt': 'Prefere o áudio original. Legendas em português, do arquivo ou do OpenSubtitles.',
  'original-en': 'Prefere o áudio original. Legendas em inglês, do arquivo ou do OpenSubtitles.',
  original: 'Áudio original. Só aparecem legendas forçadas, como placas e falas em outra língua.'
}

const BATTERY_LABEL: Record<NonNullable<Controllers['connected'][number]['battery']>, string> = {
  empty: 'Bateria acabando',
  low: 'Bateria fraca',
  medium: 'Bateria pela metade',
  full: 'Bateria cheia',
  max: 'Bateria cheia',
  wired: 'Com fio'
}

const updateNote = (u: UpdateStatus) =>
  u.state === 'ready'
    ? `A versão ${u.next} está pronta. ${u.onQuit ? 'Entra quando você fechar o Kalli; A instala agora.' : 'A instala agora (pede a senha do computador).'}`
    : u.state === 'none'
      ? `Versão ${u.version}. As novas chegam sozinhas, baixadas quando nenhum vídeo está passando.`
      : `Versão ${u.version}. Baixando a ${u.next}${u.progress ? ` (${Math.floor(u.progress * 100)}%)` : ''} quando nenhum vídeo está passando.`

const playerNote = (p: PlayerStatus) =>
  p.state === 'ready'
    ? 'Pronto.'
    : p.state === 'installing'
      ? `Preparando${p.progress ? ` (${Math.floor(p.progress * 100)}%)` : '…'} Só acontece na primeira vez.`
      : `${p.error ?? 'Não deu para preparar.'} Pressione A para tentar de novo.`

export const SECTIONS: Section[] = [
  {
    id: 'profiles',
    label: 'Perfis',
    sub: 'Cada pessoa tem seu histórico, idioma e cor.',
    icon: Users,
    rows: ({ prefs }) => [
      ...prefs.profiles.map(
        (p, i): ActionRow => ({
          kind: 'action',
          id: `profile-${p.id}`,
          group: i === 0 ? 'Quem está assistindo' : undefined,
          label: p.name,
          profile: p,
          tag: p.id === prefs.profile.id ? 'Em uso' : 'Trocar',
          run: () => p.id !== prefs.profile.id && switchProfile(p.id)
        })
      ),
      {
        kind: 'text',
        id: 'name',
        group: 'Este perfil',
        label: 'Nome',
        value: prefs.profile.name,
        placeholder: 'Nome de quem assiste',
        keys: 'name',
        save: (name) => setProfile({ name })
      },
      choice({
        id: 'avatar',
        label: 'Imagem',
        note: 'Aparece sobre a cor de destaque deste perfil.',
        value: prefs.profile.avatar,
        options: [['', 'Inicial'], ...AVATAR_ART.map((a): [AvatarId, string] => [a.id, a.label])],
        images: ['', ...AVATAR_ART.map((a) => a.src)],
        set: own('avatar')
      }),
      { kind: 'text', id: 'new', label: 'Novo perfil', value: '', placeholder: 'Nome de quem vai assistir', keys: 'name', save: addProfile },
      ...(prefs.profiles.length > 1
        ? [
            {
              kind: 'action',
              id: 'remove',
              label: `Remover ${prefs.profile.name}`,
              tag: 'Remover',
              confirm: `O histórico de ${prefs.profile.name} será apagado.`,
              run: () => removeProfile(prefs.profile.id)
            } satisfies ActionRow
          ]
        : [])
    ]
  },
  {
    id: 'video',
    label: 'Vídeo',
    sub: 'Valem para este computador e esta tela.',
    icon: MonitorPlay,
    rows: ({ prefs: { settings: s } }) => [
      choice({
        id: 'highQuality',
        label: 'Imagem',
        note: 'Na máxima, o player usa os melhores filtros de escala e suaviza as faixas que a compressão deixa em céus e sombras. Se o vídeo engasgar, volte para Equilibrada.',
        value: s.highQuality,
        options: [
          [false, 'Equilibrada'],
          [true, 'Máxima (GPU forte)']
        ],
        set: setting('highQuality')
      }),
      choice({
        id: 'smoothMotion',
        label: 'Movimento',
        note: 'Sincroniza o vídeo com a tela para panorâmicas sem tremidas.',
        value: s.smoothMotion,
        options: [
          [false, 'Padrão'],
          [true, 'Sem tremidas']
        ],
        set: setting('smoothMotion')
      }),
      choice({
        id: 'cinema',
        label: 'Modo cinema',
        note: 'No começo de cada filme ou maratona, o Windows liga o HDR para um filme em HDR. Sem confirmação em 15 segundos, tudo volta sozinho.',
        value: s.cinema,
        options: [
          [true, 'Ajustar a tela'],
          [false, 'Não mexer na tela']
        ],
        set: setting('cinema')
      }),
      choice({
        id: 'cih',
        label: 'Tela do projetor',
        note: 'Para tela 2.39:1 com zoom (altura constante): o menu e os filmes ficam dentro da faixa da tela, e um filme 16:9 aparece com bordas nas laterais.',
        value: s.cih,
        options: [
          [false, '16:9'],
          [true, '2.39:1 (CIH)']
        ],
        set: setting('cih')
      }),
      choice({
        id: 'maxRes',
        label: 'Resolução máxima',
        note: 'Cópias acima disso só tocam quando não há outra. Economiza internet.',
        value: s.maxRes,
        options: [
          [2160, '4K'],
          [1080, '1080p'],
          [720, '720p']
        ],
        set: setting('maxRes')
      })
    ]
  },
  {
    id: 'preferences',
    label: 'Preferências',
    sub: 'Valem para todos os perfis deste computador.',
    icon: SlidersHorizontal,
    rows: ({ prefs: { settings: s }, player, update }) => [
      {
        kind: 'text',
        id: 'tmdbKey',
        label: 'Títulos em português',
        value: s.tmdbKey,
        placeholder: 'Chave da API do TMDB',
        secret: true,
        keys: 'url',
        note: 'Grátis em themoviedb.org. Só o código IMDb de cada título é enviado. Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.',
        save: (v) => setSettings({ tmdbKey: v.trim() })
      },
      choice({
        id: 'autostart',
        label: 'Ao ligar o computador',
        value: s.autostart,
        options: [
          [false, 'Não abrir'],
          [true, 'Esperar na bandeja']
        ],
        set: setting('autostart')
      }),
      choice({
        id: 'closeToTray',
        label: 'Ao fechar a janela',
        note: 'Com downloads em andamento ele sempre fica na bandeja até terminar, e avisa.',
        value: s.closeToTray,
        options: [
          [false, 'Sair do Kalli'],
          [true, 'Continuar na bandeja']
        ],
        set: setting('closeToTray')
      }),
      choice({
        id: 'ahead',
        label: 'Baixar o próximo episódio',
        note: 'Chega na melhor cópia enquanto o atual passa, e abre na hora. Depois de assistido, sai do computador.',
        value: s.ahead,
        options: [
          [true, 'Enquanto assiste'],
          [false, 'Não baixar']
        ],
        set: setting('ahead')
      }),
      choice({
        id: 'trailers',
        label: 'Trailers',
        note: 'Um trailer sem som surge atrás da página do título depois de alguns segundos.',
        value: s.trailers,
        options: [
          [true, 'Na página do título'],
          [false, 'Desligados']
        ],
        set: setting('trailers')
      }),
      choice({
        id: 'preshow',
        label: 'Pré-estreia',
        note: 'Antes de um filme começar do início, dois trailers com som, como no cinema. A pula direto para o filme.',
        value: s.preshow,
        options: [
          [false, 'Direto ao filme'],
          [true, 'Dois trailers antes']
        ],
        set: setting('preshow')
      }),
      choice({
        id: 'uiSounds',
        label: 'Sons da interface',
        value: s.uiSounds,
        options: [
          [true, 'Ligados'],
          [false, 'Desligados']
        ],
        set: setting('uiSounds')
      }),
      {
        kind: 'action',
        id: 'player',
        label: 'Player de vídeo',
        note: playerNote(player),
        tag: player.state === 'error' ? 'Tentar de novo' : undefined,
        run: () => player.state === 'error' && kalli.installPlayer().catch(() => {})
      },
      ...(update
        ? [
            {
              kind: 'action',
              id: 'update',
              label: 'Kalli',
              note: updateNote(update),
              tag: update.state === 'ready' ? 'Atualizar agora' : undefined,
              run: () => update.state === 'ready' && kalli.installUpdate()
            } satisfies ActionRow
          ]
        : [])
    ]
  },
  {
    id: 'language',
    label: 'Idioma e legendas',
    sub: 'Deste perfil. Decidem qual cópia toca e quais faixas abrem.',
    icon: Languages,
    rows: ({ prefs: { profile: p, settings: s } }) => [
      choice({
        id: 'language',
        label: 'Áudio e legendas',
        note: LANGUAGE_NOTE[p.language],
        value: p.language,
        options: [
          ['dub', 'Dublado'],
          ['original-pt', 'Original, legendas PT'],
          ['original-en', 'Original, legendas EN'],
          ['original', 'Original, sem legendas']
        ],
        set: own('language')
      }),
      choice({
        id: 'subtitles',
        group: 'Legendas',
        label: 'Ao dar play',
        note: 'Desligadas, só aparecem as forçadas, como placas e falas em outra língua. Dá para ligar no player, e o título lembra a escolha.',
        value: p.subtitles,
        options: [
          [false, 'Desligadas'],
          [true, 'Ligadas']
        ],
        set: own('subtitles')
      }),
      choice({
        id: 'subSize',
        label: 'Tamanho',
        value: p.subSize,
        options: [
          ['small', 'Pequena'],
          ['medium', 'Média'],
          ['large', 'Grande']
        ],
        set: own('subSize')
      }),
      choice({
        id: 'subColor',
        label: 'Cor',
        value: p.subColor,
        options: [
          ['white', 'Branca'],
          ['yellow', 'Amarela']
        ],
        set: own('subColor')
      }),
      choice({
        id: 'subBox',
        label: 'Fundo',
        value: p.subBox,
        options: [
          [false, 'Contorno'],
          [true, 'Faixa escura']
        ],
        set: own('subBox')
      }),
      choice({
        id: 'autoSkip',
        group: 'Séries',
        label: 'Aberturas e resumos',
        note: 'Quando o arquivo marca a abertura ou o resumo. Com "Perguntar", aparece um botão para pular.',
        value: p.autoSkip,
        options: [
          [false, 'Perguntar'],
          [true, 'Pular sozinho']
        ],
        set: own('autoSkip')
      }),
      choice({
        id: 'autoNext',
        label: 'Próximo episódio',
        note: 'Nos créditos, começa em 10 segundos. Depois de três seguidos sem ninguém tocar no controle, espera.',
        value: p.autoNext,
        options: [
          [true, 'Começar sozinho'],
          [false, 'Esperar']
        ],
        set: own('autoNext')
      }),
      choice({
        id: 'audioPassthrough',
        group: 'Som deste computador',
        label: 'Saída',
        note: 'Para receiver ou soundbar com Dolby Atmos e DTS:X.',
        value: s.audioPassthrough,
        options: [
          [false, 'Decodificar aqui'],
          [true, 'Enviar ao receiver']
        ],
        set: setting('audioPassthrough')
      }),
      choice({
        id: 'sound',
        label: 'Som',
        note: s.audioPassthrough
          ? 'Com o receiver, o som chega como foi mixado: ele mesmo cuida disso.'
          : 'Diálogos claros sobe as vozes e segura as explosões; Noturno deixa tudo num volume só. Também muda no player, em Áudio e legendas.',
        value: s.sound,
        options: [
          ['original', 'Original'],
          ['dialogue', 'Diálogos claros'],
          ['night', 'Noturno']
        ],
        set: setting('sound')
      })
    ]
  },
  {
    id: 'lights',
    label: 'Luzes',
    sub: 'A sala acompanha o filme: as luzes se apagam no play, acendem de leve na pausa e voltam com os créditos.',
    icon: Lamp,
    rows: ({ prefs: { settings: s }, rooms, setRooms }) => [
      {
        kind: 'action',
        id: 'hue',
        group: 'Philips Hue',
        label: s.hueUser ? `Ponte Hue em ${s.hueBridge}` : 'Parear a ponte Hue',
        note: s.hueUser
          ? 'Pareada. Para trocar de ponte, pareie de novo.'
          : 'Aperte o botão redondo em cima da ponte e, logo depois, A. A espera dura até 30 segundos.',
        tag: s.hueUser ? 'Parear de novo' : 'Parear',
        run: async () => {
          setRooms(await kalli.pairLights())
          await reloadSettings()
        },
        secondary: s.hueUser
          ? {
              tag: 'Esquecer',
              confirm: 'As luzes deixam de acompanhar os filmes.',
              run: async () => {
                await setSettings({ hueBridge: '', hueUser: '', hueRoom: '' })
                setRooms([])
              }
            }
          : undefined
      },
      ...(rooms.length
        ? [
            choice({
              id: 'hueRoom',
              label: 'Cômodo',
              note: 'As luzes dele seguem o filme.',
              value: s.hueRoom,
              options: [['', 'Nenhum'] as [string, string], ...rooms.map((r): [string, string] => [r.id, r.name])],
              set: setting('hueRoom')
            })
          ]
        : []),
      {
        kind: 'text',
        id: 'lightsWebhook',
        group: 'Outro sistema',
        label: 'Webhook',
        value: s.lightsWebhook,
        placeholder: 'URL do webhook (Home Assistant e outros)',
        keys: 'url',
        note: 'Recebe um POST com {"event": "play"} (ou pause, credits, stop) a cada momento do filme.',
        save: (v) => setSettings({ lightsWebhook: v.trim() })
      }
    ]
  },
  {
    id: 'look',
    label: 'Aparência',
    sub: 'Deste perfil.',
    icon: Palette,
    rows: ({ prefs: { profile: p } }) => [
      choice({
        id: 'accent',
        label: 'Cor de destaque',
        note: 'Marca o foco, o progresso e a ação principal.',
        value: p.accent,
        options: ACCENTS.map((a) => [a.key, a.label]),
        swatches: ACCENTS.map((a) => a.color),
        set: own('accent')
      })
    ]
  },
  {
    id: 'controllers',
    label: 'Controles',
    sub: 'Os controles em uso e os pareados por Bluetooth. Um controle pareado conecta sozinho quando é ligado.',
    icon: Gamepad2,
    rows: ({ controllers: c, found, setControllers, setFound }) => {
      if (!c) return [{ kind: 'action', id: 'controllers-loading', label: 'Verificando controles…', run: () => {} }]
      const rows: ActionRow[] = c.connected.length
        ? c.connected.map((p, i) => ({
            kind: 'action',
            id: `pad-${i}-${p.name}`,
            group: i === 0 ? 'Em uso' : undefined,
            label: p.name,
            note: p.battery ? BATTERY_LABEL[p.battery] : undefined,
            run: () => {}
          }))
        : [{ kind: 'action', id: 'pad-none', group: 'Em uso', label: 'Nenhum controle em uso', note: 'Ligue um controle já pareado e ele conecta sozinho, ou pareie um novo abaixo.', run: () => {} }]
      if (!c.bluetooth) return rows
      rows.push(
        ...c.paired.map(
          (d, i): ActionRow => ({
            kind: 'action',
            id: `paired-${d.id}`,
            group: i === 0 ? 'Pareados por Bluetooth' : undefined,
            label: d.name,
            note: d.connected ? 'Conectado' : 'Desligado: ligue o controle e ele conecta sozinho.',
            run: () => {},
            secondary: {
              tag: 'Esquecer',
              confirm: 'Para usar de novo, será preciso parear outra vez.',
              run: () => kalli.forgetController(d.id).then(setControllers)
            }
          })
        ),
        {
          kind: 'action',
          id: 'controllers-search',
          group: 'Parear um controle novo',
          label: found ? 'Procurar de novo' : 'Procurar controles',
          tag: 'Procurar',
          note: 'Segure o botão de parear do controle até a luz piscar rápido (Xbox: o botão de sincronizar em cima; PlayStation: Share + PS; Switch Pro: sincronizar). A busca leva uns 30 segundos.',
          run: async () => setFound(await kalli.scanControllers())
        },
        ...(found?.length
          ? found.map(
              (d): ActionRow => ({
                kind: 'action',
                id: `found-${d.id}`,
                label: d.name,
                note: 'Em modo de parear, aqui perto.',
                tag: 'Parear',
                run: async () => {
                  setControllers(await kalli.pairController(d.id))
                  setFound(found.filter((x) => x.id !== d.id))
                }
              })
            )
          : found
            ? [{ kind: 'action' as const, id: 'found-none', label: 'Nenhum controle em modo de parear', note: 'Confira se a luz do controle pisca rápido e procure de novo.', run: () => {} }]
            : [])
      )
      return rows
    }
  },
  {
    id: 'downloads',
    label: 'Downloads',
    sub: 'Da casa toda, mais recentes primeiro. A pausa ou retoma; X apaga o arquivo do computador.',
    icon: HardDriveDownload,
    rows: ({ downloads }) =>
      downloads.length
        ? [...downloads]
            .sort((a, b) => b.at - a.at)
            .map(
              (d): ActionRow => ({
                kind: 'action',
                id: `download-${d.key}`,
                label: d.title,
                note: downloadStatus(d),
                tag: d.state === 'downloading' ? 'Pausar' : d.state === 'done' ? undefined : 'Retomar',
                progress: d.state !== 'done' && d.size ? d.received / d.size : undefined,
                run: () => (d.state === 'downloading' ? kalli.pauseDownload(d.key) : d.state !== 'done' && kalli.resumeDownload(d.key)),
                secondary: {
                  tag: 'Apagar',
                  confirm: d.state === 'done' ? 'O arquivo é apagado do computador.' : 'O download para e o que já veio é apagado.',
                  run: () => kalli.removeDownload(d.key).then(refreshLibrary)
                }
              })
            )
        : [{ kind: 'action', id: 'downloads-empty', label: 'Nenhum download ainda', note: 'Na página de um título, X baixa a melhor cópia para ver sem depender da conexão.', run: () => {} }]
  },
  {
    id: 'addons',
    label: 'Addons',
    sub: 'Fontes de catálogo, cópias e legendas para toda a casa. Qualquer addon do Stremio funciona.',
    icon: Puzzle,
    rows: ({ addons, setAddons, preview }) => [
        {
          kind: 'text',
          id: 'addon-url',
          label: 'Adicionar por URL',
          value: '',
          placeholder: 'URL do manifest.json do addon',
          keys: 'url',
          note: 'Você vê o que o addon traz antes de adicionar.',
          save: async (url) => preview(await kalli.previewAddon(url))
        },
        ...addons.map(
          (a, i): ActionRow => ({
            kind: 'action',
            id: `addon-${a.transportUrl}`,
            group: i === 0 ? 'Instalados' : undefined,
            label: a.manifest.name,
            isAddon: true,
            addon: a,
            tag: 'Remover',
            confirm: a.manifest.catalogs.length ? 'As seções dele somem da tela inicial.' : 'Ele deixa de ser consultado.',
            run: () => kalli.removeAddon(a.transportUrl).then(setAddons)
          })
        )
      ]
  }
]

export const masked = (v: string) => (v.length > 4 ? `••••••${v.slice(-4)}` : v)
