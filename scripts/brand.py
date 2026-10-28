"""Kalli brand assets: the mark, the wordmark, app and tray icons, and the preset profile avatars.

Every asset is drawn here as SVG (the source of truth) and rasterized with resvg, so the PNG/ICO files never drift
from the vector ones. Run from the repository root after `pip install -r scripts/requirements.txt`:

    python scripts/brand.py

Writes:
  build/icon.png, build/icon.ico   electron-builder's app icon (installer, taskbar, window)
  build/tray.png                   the tray icon, 32 px (main process, `?asset` import)
  brand/                           logo lockups and app icon, for README and stores
  brand/social/                    the social kit: profile picture, posts, story, link preview, headers (SOCIAL)
  src/renderer/src/assets/brand/   the mark the interface shows
  src/renderer/src/assets/avatars/ the preset profile pictures (ids listed in AVATARS, mirrored in shared/types.ts)
"""

from __future__ import annotations

import io
import math
from pathlib import Path

import resvg_py
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2"

# DESIGN.md palette.
GROUND = "#13110e"
INK = "#efe7d6"
EDITION = "#f2b705"
# Brand surfaces (app icon, social kit) sit on true black: on OLED screens the canvas switches off and only the mark
# lights up. The interface itself keeps its warm `ground`.
AMOLED = "#000000"


def _lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c: float) -> float:
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def darker(hex_: str, dl: float) -> str:
    """The same hue and chroma ratio, `dl` lower in OKLCH lightness: a shade of the colour, never a muddier one."""
    r, g, b = (_lin(int(hex_[i : i + 2], 16) / 255) for i in (1, 3, 5))
    l_ = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m_ = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s_ = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    A = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    k = (L - dl) / L  # chroma falls with lightness, keeping the colour's vividness proportional
    L, A, B = L - dl, A * k, B * k
    l_ = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m_ = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s_ = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    rgb = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    return "#" + "".join(f"{round(_gam(c) * 255):02x}" for c in rgb)


# The mark's second tone: edition in shadow, on edition's own hue (a mirror's dark side, not a bevel).
SHADE = darker(EDITION, 0.2)


# ---------------------------------------------------------------- the mark

TWIST = 16


def mark_paths(cx: float, cy: float, r: float) -> str:
    """Six mirrored facets turning around an open eyepiece: a kaleidoscope seen down its tube.

    Each petal is a kite from the eyepiece to a tip; its halves are edition and edition in shadow, the two sides
    of a kaleidoscope's mirror. Every shaded half meets the next petal's lit half, so no line is needed between
    petals, and the hexagonal eyepiece is left empty: real negative space, whatever sits behind the mark.
    """
    R, rs, r0 = r, r * 0.6, r * 0.26

    def pt(radius: float, deg: float) -> tuple[float, float]:
        a = math.radians(deg - 90)
        return cx + radius * math.cos(a), cy + radius * math.sin(a)

    def poly(points: list[tuple[float, float]], fill: str) -> str:
        d = "M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in points) + "Z"
        return f'<path d="{d}" fill="{fill}"/>'

    out = []
    for k in range(6):
        a = k * 60
        # The tip leans ahead of the petal's axis: the rosette turns, never a still star.
        tip = pt(R, a + TWIST)
        left, right = pt(rs, a - 30), pt(rs, a + 30)
        in_l, in_r = pt(r0, a - 30), pt(r0, a + 30)
        axis = pt(r0 * math.cos(math.radians(30)), a)
        out.append(poly([axis, in_l, left, tip], EDITION))
        out.append(poly([axis, tip, right, in_r], SHADE))
    return "\n  ".join(out)


def svg(w: float, h: float, body: str, extra: str = "") -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}">{extra}\n  {body}\n</svg>\n'


def mark_svg() -> str:
    """The mark alone on a transparent canvas."""
    return svg(100, 100, mark_paths(50, 50, 48))


def icon_svg(size: int = 1024) -> str:
    """The app icon: the mark on a flat black tile. No glow, no light: the screen is off and the yellow is the light."""
    s = size
    tile = f'<rect width="{s}" height="{s}" rx="{s * 0.225:g}" fill="{AMOLED}"/>'
    return svg(s, s, f"{tile}\n  {mark_paths(s / 2, s / 2, s * 0.4)}")


# ---------------------------------------------------------------- the wordmark

def wordmark(text: str = "KALLI", tracking: float = 0.012) -> tuple[str, float, float]:
    """Outlined Archivo 800 at width 64, the interface's display style. Returns (path d, width, cap height) in font units."""
    font = TTFont(FONT)
    font = instancer.instantiateVariableFont(font, {"wght": 800, "wdth": 64})
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    cap = font["OS/2"].sCapHeight
    pen = SVGPathPen(glyphs)
    x = 0.0
    names = [cmap[ord(c)] for c in text]
    for i, name in enumerate(names):
        g = glyphs[name]
        # Flip y: font units grow up, SVG grows down; the cap line sits at y=0.
        g.draw(TransformPen(pen, (1, 0, 0, -1, x, cap)))
        x += g.width + (tracking * upm if i < len(names) - 1 else 0)
    return pen.getCommands(), x, cap


def lockup_svg(ink: str) -> str:
    """Mark beside the wordmark; the mark is a little taller than the capitals and centred on them."""
    d, w, cap = wordmark()
    scale = 100 / cap  # caps 100 units tall
    mark_d = 128
    gap = 34
    pad = 24
    width = pad * 2 + mark_d + gap + w * scale
    height = pad * 2 + mark_d
    mark = mark_paths(pad + mark_d / 2, pad + mark_d / 2, mark_d / 2)
    tx = pad + mark_d + gap
    ty = pad + (mark_d - 100) / 2
    word = f'<path transform="translate({tx:.2f} {ty:.2f}) scale({scale:.5f})" d="{d}" fill="{ink}"/>'
    return svg(round(width, 2), height, f"{mark}\n  {word}")


# ---------------------------------------------------------------- social kit

# Every social image is a full-bleed square-cornered canvas: each network crops (circle, rounded square) on its own.
SOCIAL = {
    # name: (width, height, layout, cap height of the wordmark in px; for "mark", the mark's radius)
    "profile": (1080, 1080, "mark", 340),  # profile picture; stays inside the circle crop
    "post": (1080, 1080, "stack", 190),
    "post-portrait": (1080, 1350, "stack", 220),  # Instagram 4:5
    "story": (1080, 1920, "stack", 240),  # stories, reels and shorts covers
    "og": (1200, 630, "row", 130),  # link previews (Open Graph, WhatsApp, Telegram)
    "github": (1280, 640, "row", 140),  # repository social preview
    "x-header": (1500, 500, "row", 130),
    "youtube-banner": (2560, 1440, "row", 210),  # kept inside YouTube's 1546×423 safe area
}


def _text(d: str, x: float, y: float, scale: float, fill: str, opacity: float = 1) -> str:
    op = f' fill-opacity="{opacity:g}"' if opacity < 1 else ""
    return f'<path transform="translate({x:.2f} {y:.2f}) scale({scale:.5f})" d="{d}" fill="{fill}"{op}/>'


def social_svg(W: int, H: int, layout: str, c: float) -> str:
    """The brand on AMOLED black, sized from the wordmark's cap height `c`.

    "mark" is the mark alone; "stack" piles mark, wordmark and line on one centre axis (square and tall formats);
    "row" sets the mark beside the wordmark with the line hanging from the wordmark's left edge (wide formats).
    Each block is centred on the canvas a touch above the middle, where the eye puts the centre.
    """
    bg = f'<rect width="{W}" height="{H}" fill="{AMOLED}"/>'
    if layout == "mark":
        return svg(W, H, f"{bg}\n  {mark_paths(W / 2, H / 2, c)}")
    d, w, cap = wordmark()
    tag_d, tag_w, tag_cap = wordmark("SUA SALA DE CINEMA", tracking=0.12)
    ws, word_w = c / cap, w * c / cap
    tc = c * (0.2 if layout == "stack" else 0.15)  # the line's cap height: larger where the canvas is seen small
    ts, line_w = tc / tag_cap, tag_w * tc / tag_cap
    lift = H * 0.02
    if layout == "stack":
        m = c * 1.7  # mark diameter
        total = m + c * 0.45 + c + c * 0.32 + tc
        y = (H - total) / 2 - lift
        parts = [
            mark_paths(W / 2, y + m / 2, m / 2),
            _text(d, (W - word_w) / 2, y + m + c * 0.45, ws, INK),
            _text(tag_d, (W - line_w) / 2, y + m + c * 1.45 + c * 0.32, ts, INK, 0.7),
        ]
    else:
        m = c * 1.27
        gap = c * 0.35
        x = (W - (m + gap + word_w)) / 2
        cy = H / 2 - lift - (c * 0.24 + tc) / 2  # the line below pulls the block's centre down; lift it back
        wx = x + m + gap
        parts = [
            mark_paths(x + m / 2, cy, m / 2),
            _text(d, wx, cy - c / 2, ws, INK),
            _text(tag_d, wx + c * 0.03, cy + c / 2 + c * 0.24, ts, INK, 0.7),
        ]
    return svg(W, H, "\n  ".join([bg, *parts]))


# ---------------------------------------------------------------- avatars

D = GROUND  # line and shadow
C = INK  # highlight
# Each avatar is drawn on a 100×100 canvas, transparent: the interface paints the profile's accent behind it,
# so one picture still tells two people apart by colour.


def av_pipoca() -> str:
    # A striped bucket, tapering down, with popcorn heaped over the rim.
    bucket = "M27,44 L73,44 L66,88 Q50,92 34,88 Z"
    stripes = "".join(
        f'<path d="M{27 + i * 9.2:.1f},44 L{31.6 + i * 9.2:.1f},44 L{33.8 + i * 6.4:.1f},89.5 L{30 + i * 6.4 + 0.6:.1f},89 Z" fill="{C}"/>'
        for i in (1, 3)
    )
    pops = [(33, 40, 9), (44, 34, 10), (56, 35, 10), (67, 40, 9), (39, 27, 8), (51, 24, 9), (62, 28, 8), (50, 42, 9)]
    corn = "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{C}" stroke="{D}" stroke-width="3.2"/>' for x, y, r in pops)
    rim = f'<rect x="24" y="42" width="52" height="8" rx="3" fill="{D}"/>'
    return f'<path d="{bucket}" fill="{D}"/>{stripes}{corn}{rim}'


def av_claquete() -> str:
    # A clapperboard: the slate, and its striped clapper lifted open.
    slate = f'<rect x="20" y="44" width="60" height="40" rx="5" fill="{D}"/>'
    lines = f'<rect x="28" y="58" width="44" height="3.5" rx="1.75" fill="{C}"/><rect x="28" y="68" width="30" height="3.5" rx="1.75" fill="{C}"/>'
    bar = f'<rect x="20" y="33" width="60" height="11" rx="2.5" fill="{D}"/>'
    stripes_bar = "".join(f'<path d="M{24 + i * 14},33 L{31 + i * 14},33 L{27 + i * 14},44 L{20 + i * 14},44 Z" fill="{C}"/>' for i in range(4))
    clapper = (
        f'<g transform="rotate(-18 21 30)"><rect x="20" y="19" width="60" height="11" rx="2.5" fill="{D}"/>'
        + "".join(f'<path d="M{27 + i * 14},19 L{34 + i * 14},19 L{30 + i * 14},30 L{23 + i * 14},30 Z" fill="{C}"/>' for i in range(4))
        + "</g>"
    )
    hinge = f'<circle cx="23" cy="32" r="4.5" fill="{D}" stroke="{C}" stroke-width="2"/>'
    return slate + lines + bar + f'<g clip-path="url(#bar)">{stripes_bar}</g>' + clapper + hinge


def av_rolo() -> str:
    # A film reel: five windows round a hub, and the film running off it.
    out = [f'<path d="M50,80 C64,80 78,82 86,86" fill="none" stroke="{D}" stroke-width="7" stroke-linecap="round"/>']
    out.append(f'<circle cx="46" cy="48" r="32" fill="{D}"/>')
    for k in range(5):
        a = math.radians(k * 72 - 90)
        out.append(f'<circle cx="{46 + 18 * math.cos(a):.2f}" cy="{48 + 18 * math.sin(a):.2f}" r="8" fill="{C}"/>')
    out.append(f'<circle cx="46" cy="48" r="5" fill="{C}"/>')
    return "".join(out)


def av_oculos() -> str:
    # 3D glasses, seen straight on, with a glint on each lens.
    frame = (
        f'<path d="M14,40 L86,40 Q89,40 88.5,43 L85,62 Q84,68 78,68 L60,68 Q55,68 53.5,63 L51.5,57 Q50,54 48.5,57 '
        f'L46.5,63 Q45,68 40,68 L22,68 Q16,68 15,62 L11.5,43 Q11,40 14,40 Z M56,46 L59,61 L77,61 L81,46 Z" '
        f'fill="{D}" fill-rule="evenodd"/>'
    )
    # One lens in ink, the other cut out of the frame: the profile's own colour becomes the second lens.
    left = f'<path d="M19,46 L44,46 L41,61 L23,61 Z" fill="{C}"/>'
    arms = f'<path d="M12,42 L6,36 M88,42 L94,36" stroke="{D}" stroke-width="5" stroke-linecap="round"/>'
    return arms + frame + left


def av_ingresso() -> str:
    # A cinema ticket, tilted, with its tear line and a star.
    star = []
    for k in range(10):
        a = math.radians(k * 36 - 90)
        r = 9 if k % 2 == 0 else 3.8
        star.append(f"{38 + r * math.cos(a):.2f},{50 + r * math.sin(a):.2f}")
    body = (
        '<path d="M18,32 L82,32 L82,43 A7,7 0 0 0 82,57 L82,68 L18,68 L18,57 A7,7 0 0 0 18,43 Z" '
        f'fill="{D}"/>'
    )
    perf = "".join(f'<rect x="61" y="{36 + i * 6.4:.1f}" width="2.6" height="3.6" rx="1.3" fill="{C}"/>' for i in range(5))
    lines = f'<rect x="68" y="44" width="8" height="3" rx="1.5" fill="{C}"/><rect x="68" y="53" width="8" height="3" rx="1.5" fill="{C}"/>'
    return f'<g transform="rotate(-14 50 50)">{body}{perf}{lines}<polygon points="{" ".join(star)}" fill="{C}"/></g>'


def av_controle() -> str:
    # A gamepad, Kalli's remote: d-pad, four buttons, the grips.
    body = (
        f'<path d="M30,34 L70,34 Q84,34 88,50 L92,66 Q95,78 84,79 Q77,80 72,71 L68,64 L32,64 L28,71 Q23,80 16,79 '
        f'Q5,78 8,66 L12,50 Q16,34 30,34 Z" fill="{D}"/>'
    )
    dpad = f'<path d="M27,43 h6 v6 h6 v6 h-6 v6 h-6 v-6 h-6 v-6 h6 Z" fill="{C}"/>'
    btns = "".join(f'<circle cx="{x}" cy="{y}" r="3.6" fill="{C}"/>' for x, y in ((70, 44), (77, 51), (70, 58), (63, 51)))
    mid = f'<rect x="44" y="45" width="5" height="2.6" rx="1.3" fill="{C}"/><rect x="52" y="45" width="5" height="2.6" rx="1.3" fill="{C}"/>'
    return body + dpad + btns + mid


AVATARS = {
    "pipoca": av_pipoca,
    "claquete": av_claquete,
    "rolo": av_rolo,
    "oculos": av_oculos,
    "ingresso": av_ingresso,
    "controle": av_controle,
}


def avatar_svg(draw) -> str:
    # The clapperboard's lower bar clips its stripes; harmless for the others.
    defs = '<defs><clipPath id="bar"><rect x="20" y="33" width="60" height="11" rx="2.5"/></clipPath></defs>'
    # Drawn a little smaller than the canvas so nothing touches the round crop.
    return svg(100, 100, f'<g transform="translate(50 51) scale(0.8) translate(-50 -50)">{draw()}</g>', extra=defs)


# ---------------------------------------------------------------- output

def png(svg_text: str, size: int, height: int | None = None) -> bytes:
    return bytes(resvg_py.svg_to_bytes(svg_string=svg_text, width=size, height=height or size))


def write(path: Path, data: str | bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8", newline="\n")
    else:
        path.write_bytes(data)
    print("wrote", path.relative_to(ROOT))


def sheet(cells: list[tuple[str, str]], cell: int = 220) -> bytes:
    """A contact sheet of the avatars on every accent, to review them together."""
    accents = ["#f2b705", "#fb923c", "#fb7185", "#a78bfa", "#38bdf8", "#34d399"]
    img = Image.new("RGB", (cell * len(cells), cell * len(accents)), GROUND)
    for r, color in enumerate(accents):
        for c, (_, art) in enumerate(cells):
            disc = svg(100, 100, f'<circle cx="50" cy="50" r="48" fill="{color}"/>' + art.split("\n  ", 1)[1].rsplit("\n</svg>", 1)[0])
            tile = Image.open(io.BytesIO(png(disc, cell - 20)))
            img.paste(tile, (c * cell + 10, r * cell + 10), tile)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def main() -> None:
    assets = ROOT / "src/renderer/src/assets"
    write(assets / "brand/kalli-mark.svg", mark_svg())
    for name, draw in AVATARS.items():
        write(assets / f"avatars/{name}.svg", avatar_svg(draw))

    icon = icon_svg()
    write(ROOT / "build/icon.png", png(icon, 1024))
    ico = Image.open(io.BytesIO(png(icon, 256)))
    buf = io.BytesIO()
    ico.save(buf, "ICO", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    write(ROOT / "build/icon.ico", buf.getvalue())
    # The tray gets the tile, not the bare mark: yellow alone measures 1.8:1 on a light taskbar.
    write(ROOT / "build/tray.png", png(icon, 32))

    write(ROOT / "brand/kalli-icon.svg", icon)
    write(ROOT / "brand/kalli-icon.png", png(icon, 512))
    for name, ink in (("kalli-logo", INK), ("kalli-logo-light", GROUND)):
        s = lockup_svg(ink)
        write(ROOT / f"brand/{name}.svg", s)
        w = float(s.split('width="')[1].split('"')[0])
        h = float(s.split('height="')[1].split('"')[0])
        write(ROOT / f"brand/{name}.png", png(s, round(w * 4), round(h * 4)))
    for name, (w, h, layout, c) in SOCIAL.items():
        write(ROOT / f"brand/social/{name}-{w}x{h}.png", png(social_svg(w, h, layout, c), w, h))
    write(ROOT / "brand/avatars-sheet.png", sheet([(n, avatar_svg(d)) for n, d in AVATARS.items()]))


if __name__ == "__main__":
    main()
