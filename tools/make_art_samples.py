#!/usr/bin/env python3
"""Sample pictures for 天面アート.

Every set is one picture split into colour layers (one SVG per filament, all with the same viewBox,
the first layer is the front-most). Writes samples/art/<set>/<n>_<layer>.svg and js/artsamples.js.
All drawings are original. Run from the repository root:  python3 tools/make_art_samples.py
"""
import json, math, os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANNER = "0 0 300 110"   # wide pictures, meant to span a whole board
MOTIF = "0 0 100 100"    # small pictures, meant to be placed several times


def f(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def svg(vb, body, defs=""):
    return ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="%s">%s%s</svg>'
            % (vb, "<defs>%s</defs>" % defs if defs else "", body))


def star(cx, cy, r, rot=-90, inner=0.45):
    pts = []
    for i in range(10):
        a = math.radians(rot + i * 36)
        rr = r if i % 2 == 0 else r * inner
        pts.append("%s %s" % (f(cx + rr * math.cos(a)), f(cy + rr * math.sin(a))))
    return "M" + " L".join(pts) + "Z"


def petal(cx, cy, length, width, ang, notch=0.18):
    """cherry-blossom petal from (cx,cy) pointing at angle ang (deg), with a notch at the tip"""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    P = lambda s, t: (cx + ux * s * length + vx * t * width, cy + uy * s * length + vy * t * width)
    p0 = P(0, 0); l1 = P(0.35, -0.55); l2 = P(0.95, -0.5); t1 = P(1.0, -0.16); n = P(1 - notch, 0)
    t2 = P(1.0, 0.16); r2 = P(0.95, 0.5); r1 = P(0.35, 0.55)
    q = lambda p: "%s %s" % (f(p[0]), f(p[1]))
    return "M%s C%s %s %s L%s L%s C%s %s %sZ" % (q(p0), q(l1), q(l2), q(t1), q(n), q(t2), q(r2), q(r1), q(p0))


def flower(cx, cy, r, rot=0):
    return "".join('<path d="%s"/>' % petal(cx, cy, r, r * 0.62, rot + k * 72) for k in range(5))


SETS = []


def add(sid, name, vb, fit, layers, kind="picture"):
    SETS.append({"id": sid, "name": name, "fit": fit, "kind": kind, "layers": [{"name": n, "mode": m, "svg": s} for n, m, s in layers]})


# 1) sun, waves and mountains (the original test picture)
add("sun_wave_mountain", "太陽と波と山", BANNER, "layout", [
    ("太陽", "all", svg(BANNER, '<circle cx="220" cy="32" r="20" fill="#e33"/>')),
    ("波", "dark", svg(BANNER, '<path d="M0 75 Q25 55 50 75 T100 75 T150 75 T200 75 T250 75 T300 75 V110 H0 Z" fill="#136"/>'
                              '<path d="M0 95 Q25 80 50 95 T100 95 T150 95 T200 95 T250 95 T300 95" stroke="#fff" stroke-width="5" fill="none"/>')),
    ("山", "all", svg(BANNER, '<path d="M0 90 L60 30 L110 80 L160 20 L240 95 L300 60 V110 H0 Z" fill="#333"/>')),
])

# 2) a snow-capped volcano and the morning sun
mt = "M20 110 C70 88 118 52 134 26 L166 26 C182 52 230 88 280 110 Z"
snow = "M134 26 L166 26 C170 33 175 41 181 48 L172 45 L165 53 L157 45 L150 54 L143 45 L135 53 L128 45 L119 48 C125 41 130 33 134 26 Z"
cloud = ("M36 92 C36 84 46 80 53 84 C56 76 70 75 74 83 C80 79 90 82 89 90 C96 90 98 98 92 100 L40 100 C33 100 31 94 36 92 Z"
         "M206 84 C207 77 216 74 222 78 C226 71 238 71 241 79 C247 76 256 80 254 87 C260 88 261 95 255 96 L210 96 C203 96 201 88 206 84 Z")
add("fuji", "雪山と朝日", BANNER, "layout", [
    ("雪", "all", svg(BANNER, '<path d="%s" fill="#ffffff"/>' % snow)),
    ("雲", "all", svg(BANNER, '<path d="%s" fill="#b9d3ea"/>' % cloud)),
    ("朝日", "all", svg(BANNER, '<circle cx="238" cy="30" r="15" fill="#e53935"/>')),
    ("山", "all", svg(BANNER, '<path d="%s" fill="#2f4b7c"/>' % mt)),
])

# 3) 青海波 (seigaiha): rows of concentric scales, lower rows drawn over the upper ones (masks)
R = 20.0
def seigaiha(scale_body, colour):
    rows = list(range(-1, 14))
    defs = ['<g id="s">%s</g>' % scale_body]
    for par in (0, 1):
        xs = [i * 2 * R + par * R for i in range(-1, 9)]
        defs.append('<g id="r%d">%s</g>' % (par, "".join('<use xlink:href="#s" x="%s"/>' % f(x) for x in xs)))
        defs.append('<g id="c%d">%s</g>' % (par, "".join('<circle cx="%s" r="%s"/>' % (f(x), f(R)) for x in xs)))
    body = []
    for r in rows:
        y = r * R / 2
        later = "".join('<use xlink:href="#c%d" y="%s" fill="#000"/>' % ((r + k) % 2, f(y + k * R / 2)) for k in (1, 2, 3))
        defs.append('<mask id="m%d" maskUnits="userSpaceOnUse" x="-60" y="-60" width="420" height="240">'
                    '<rect x="-60" y="-60" width="420" height="240" fill="#fff"/>%s</mask>' % (r + 1, later))
        body.append('<g mask="url(#m%d)"><use xlink:href="#r%d" y="%s"/></g>' % (r + 1, r % 2, f(y)))
    return svg(BANNER, '<g fill="%s">%s</g>' % (colour, "".join(body)), "".join(defs))

ring = lambda ro, ri: '<path fill-rule="evenodd" d="M%s 0A%s %s 0 1 0 %s 0A%s %s 0 1 0 %s 0ZM%s 0A%s %s 0 1 0 %s 0A%s %s 0 1 0 %s 0Z"/>' % (
    f(-ro), f(ro), f(ro), f(ro), f(ro), f(ro), f(-ro), f(-ri), f(ri), f(ri), f(ri), f(ri), f(ri), f(-ri))
navy = ring(19.4, 17.0) + ring(14.2, 11.8) + ring(9.0, 6.6) + '<circle r="3.4"/>'
light = ring(16.4, 14.8) + ring(11.2, 9.6)
add("seigaiha", "青海波", BANNER, "layout", [
    ("紺", "all", seigaiha(navy, "#1f3a68")),
    ("水色", "all", seigaiha(light, "#7fb3d5")),
])

# 4) cherry blossoms in the wind
rnd = random.Random(7)
flowers = [(30, 30, 14, 5), (92, 70, 11, 30), (152, 26, 13, 12), (214, 64, 15, 40), (272, 28, 10, 20), (60, 92, 8, 50), (250, 96, 9, 8)]
pet, ctr = [], []
for cx, cy, r, rot in flowers:
    pet.append(flower(cx, cy, r, rot))
    ctr.append('<circle cx="%s" cy="%s" r="%s"/>' % (f(cx), f(cy), f(max(2.2, r * 0.22))))
spots = []
while len(spots) < 26:
    x, y = rnd.uniform(6, 294), rnd.uniform(6, 104)
    if all(math.hypot(x - a, y - b) > r + 9 for a, b, r, _ in flowers) and all(math.hypot(x - a, y - b) > 11 for a, b in spots):
        spots.append((x, y))
for x, y in spots:
    pet.append('<path d="%s"/>' % petal(x, y, rnd.uniform(6, 9), rnd.uniform(3.8, 5), rnd.uniform(0, 360)))
add("sakura", "桜吹雪", BANNER, "layout", [
    ("花芯", "all", svg(BANNER, '<g fill="#ad1457">%s</g>' % "".join(ctr))),
    ("花びら", "all", svg(BANNER, '<g fill="#f48fb1">%s</g>' % "".join(pet))),
])

# 5) crescent moon and stars
moon = ('<mask id="mm" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="110"><rect width="300" height="110" fill="#fff"/>'
        '<circle cx="62" cy="44" r="22" fill="#000"/></mask>')
rnd = random.Random(11)
stars = []
big = [(120, 26, 8), (170, 70, 6.5), (236, 30, 9), (282, 76, 6), (96, 84, 5.5), (205, 94, 5), (150, 40, 4.5), (20, 90, 5)]
for x, y, r in big:
    stars.append('<path d="%s"/>' % star(x, y, r, rot=-90 + rnd.uniform(-12, 12)))
dots = []
while len(dots) < 34:
    x, y = rnd.uniform(4, 296), rnd.uniform(4, 106)
    if math.hypot(x - 50, y - 50) < 34:
        continue
    if all(math.hypot(x - a, y - b) > r + 5 for a, b, r in big) and all(math.hypot(x - a, y - b) > 8 for a, b in dots):
        dots.append((x, y))
for x, y in dots:
    stars.append('<circle cx="%s" cy="%s" r="%s"/>' % (f(x), f(y), f(rnd.choice([1.6, 1.9, 2.3]))))
add("night", "月と星空", BANNER, "layout", [
    ("月", "all", svg(BANNER, '<circle cx="50" cy="52" r="26" fill="#f6c945" mask="url(#mm)"/>', moon)),
    ("星", "all", svg(BANNER, '<g fill="#fff3b0">%s</g>' % "".join(stars))),
])

# 6) circuit board: parallel traces with 45° bends ending in pads, two chips
traces, pads = [], []
def ringpad(x, y, ro=3.6, ri=1.3):
    if ri <= 0:                                        # solid pad (a trace runs into its centre)
        return 'M%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZ' % (f(x - ro), f(y), f(ro), f(ro), f(x + ro), f(y), f(ro), f(ro), f(x - ro), f(y))
    return ('M%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZM%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZ'
            % (f(x - ro), f(y), f(ro), f(ro), f(x + ro), f(y), f(ro), f(ro), f(x - ro), f(y),
               f(x - ri), f(y), f(ri), f(ri), f(x + ri), f(y), f(ri), f(ri), f(x - ri), f(y)))
def trace(pts):
    traces.append('<path d="M%s"/>' % " L".join("%s %s" % (f(x), f(y)) for x, y in pts))
    for x, y in (pts[0], pts[-1]):
        pads.append(ringpad(x, y, 3.4, 0))
chips = [(92, 36, 44, 30, 1), (190, 50, 36, 34, -1)]
for (cx, cy, w, h, d) in chips:
    n = int(w // 8)
    for i in range(n):
        x = cx + (i + 0.5) * w / n
        k = i if d > 0 else n - 1 - i
        up = 5 + 3 * (n - 1 - k)                       # staircase: the traces never cross
        top = max(7, cy - up - 10 - 12)
        trace([(x, cy), (x, cy - up), (x + d * 10, cy - up - 10), (x + d * 10, top)])
        dn = 5 + 2.5 * k
        bot = min(104, cy + h + dn + 9 + 6)
        trace([(x, cy + h), (x, cy + h + dn), (x - d * 9, cy + h + dn + 9), (x - d * 9, bot)])
for y in (16, 58, 96):
    trace([(6, y), (40, y), (50, y + (8 if y < 58 else -8)), (66, y + (8 if y < 58 else -8))])
for y in (20, 92):
    trace([(294, y), (262, y), (252, y + (10 if y < 58 else -10)), (242, y + (10 if y < 58 else -10))])
def chip(cx, cy, w, h):
    x0, y0, x1, y1, r = cx + 2, cy + 2, cx + w - 2, cy + h - 2, 2.2
    mx, my, mr = x0 + 6, y0 + 6, 2.2                   # the pin-1 mark is a hole
    return ('M%s %sH%sV%sH%sZM%s %sA%s %s 0 1 0 %s %sA%s %s 0 1 0 %s %sZ'
            % (f(x0), f(y0), f(x1), f(y1), f(x0), f(mx - mr), f(my), f(mr), f(mr), f(mx + mr), f(my), f(mr), f(mr), f(mx - mr), f(my)))
add("circuit", "回路パターン", BANNER, "layout", [
    ("チップ", "all", svg(BANNER, '<path fill="#263238" fill-rule="evenodd" d="%s"/>' % "".join(chip(cx, cy, w, h) for cx, cy, w, h, _ in chips))),
    ("配線", "all", svg(BANNER, '<g fill="none" stroke="#c99a2e" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">%s</g>'
                                 '<path fill="#c99a2e" fill-rule="evenodd" d="%s"/>' % ("".join(traces), "".join(pads)))),
])

# 7) small motifs
paw = ('<ellipse cx="50" cy="66" rx="21" ry="17"/><ellipse cx="24" cy="42" rx="8.5" ry="11" transform="rotate(-20 24 42)"/>'
       '<ellipse cx="40" cy="27" rx="8.5" ry="11.5" transform="rotate(-6 40 27)"/><ellipse cx="60" cy="27" rx="8.5" ry="11.5" transform="rotate(6 60 27)"/>'
       '<ellipse cx="76" cy="42" rx="8.5" ry="11" transform="rotate(20 76 42)"/>')
add("paw", "肉球（ワンポイント）", MOTIF, "small", [("肉球", "all", svg(MOTIF, '<g fill="#e57373">%s</g>' % paw))])
tail = ('<g fill="none" stroke="#90caf9" stroke-width="5" stroke-linecap="round"><path d="M10 88 L50 52"/><path d="M8 66 L42 40"/><path d="M28 94 L58 64"/></g>')
add("shooting_star", "流れ星（ワンポイント）", MOTIF, "small", [
    ("星", "all", svg(MOTIF, '<path d="%s" fill="#ffd54f"/>' % star(68, 32, 26, rot=-80))),
    ("尾", "all", svg(MOTIF, tail)),
])
add("blossom", "桜（ワンポイント）", MOTIF, "small", [
    ("花芯", "all", svg(MOTIF, '<circle cx="50" cy="50" r="8" fill="#ad1457"/>')),
    ("花びら", "all", svg(MOTIF, '<g fill="#f48fb1">%s</g>' % flower(50, 50, 44, -90))),
])

# 8) simple shapes: one colour each (all share one filament), square frame; stretch them freely with the aspect lock off
SHAPE = "#37474f"
def poly(n, r=48, rot=-90, cx=50, cy=50):
    return "M" + " L".join("%s %s" % (f(cx + r * math.cos(math.radians(rot + i * 360 / n))), f(cy + r * math.sin(math.radians(rot + i * 360 / n)))) for i in range(n)) + "Z"
heart = "M50 90 C20 70 2 52 2 32 C2 16 14 6 28 6 C38 6 46 12 50 20 C54 12 62 6 72 6 C86 6 98 16 98 32 C98 52 80 70 50 90 Z"
arrow = "M4 38 H58 V14 L96 50 L58 86 V62 H4 Z"
cross = "M36 4 H64 V36 H96 V64 H64 V96 H36 V64 H4 V36 H36 Z"
simple = [
    ("circle", "丸", '<circle cx="50" cy="50" r="48"/>'),
    ("square", "四角", '<rect x="2" y="2" width="96" height="96"/>'),
    ("rounded", "角丸四角", '<rect x="2" y="2" width="96" height="96" rx="18"/>'),
    ("triangle", "三角", '<path d="M50 4 L97 92 H3 Z"/>'),
    ("diamond", "ひし形", '<path d="M50 2 L98 50 L50 98 L2 50 Z"/>'),
    ("hexagon", "六角形", '<path d="%s"/>' % poly(6, 49, -90)),
    ("star", "星", '<path d="%s"/>' % star(50, 53, 48, rot=-90, inner=0.42)),
    ("heart", "ハート", '<path d="%s"/>' % heart),
    ("ring", "輪", ring(48, 34).replace("<path ", '<path transform="translate(50 50)" ')),
    ("arrow", "矢印", '<path d="%s"/>' % arrow),
    ("cross", "十字", '<path d="%s"/>' % cross),
    ("stripes", "ストライプ", "".join('<rect x="0" y="%s" width="100" height="10"/>' % f(y) for y in (5, 25, 45, 65, 85))),
]
for sid, name, body in simple:
    add("shape_" + sid, name, MOTIF, "small", [(name, "all", svg(MOTIF, '<g fill="%s">%s</g>' % (SHAPE, body)))], kind="shape")

# ---- write ----
out = os.path.join(ROOT, "samples", "art")
shapes_dir = os.path.join(out, "shapes")
os.makedirs(shapes_dir, exist_ok=True)
for old in os.listdir(shapes_dir):
    if old.endswith(".svg"):
        os.remove(os.path.join(shapes_dir, old))
for s in SETS:
    if s["kind"] == "shape":                           # simple shapes: one folder, one file each
        with open(os.path.join(shapes_dir, "%02d_%s.svg" % (SETS.index(s) - min(SETS.index(x) for x in SETS if x["kind"] == "shape") + 1, s["name"])), "w", encoding="utf-8") as fh:
            fh.write(s["layers"][0]["svg"] + "\n")
        continue
    d = os.path.join(out, s["id"])
    os.makedirs(d, exist_ok=True)
    for old in os.listdir(d):
        if old.endswith(".svg"):
            os.remove(os.path.join(d, old))
    for i, l in enumerate(s["layers"]):
        with open(os.path.join(d, "%d_%s.svg" % (i + 1, l["name"])), "w", encoding="utf-8") as fh:
            fh.write(l["svg"] + "\n")
js = ("// artsamples.js — sample pictures for 天面アート (generated by tools/make_art_samples.py; original drawings)\n"
      "// LAK風キーキャップジェネレータ / MIT License\n"
      "// sets: [{id, name, fit:\"layout\"|\"small\", kind:\"picture\"|\"shape\", layers:[{name, mode, svg}]}] — the first layer is the front-most\n"
      "const ART_SAMPLES=" + json.dumps(SETS, ensure_ascii=False, separators=(",", ":")) + ";\n")
with open(os.path.join(ROOT, "js", "artsamples.js"), "w", encoding="utf-8") as fh:
    fh.write(js)
print(len(SETS), "sets,", sum(len(s["layers"]) for s in SETS), "layers,", len(js), "bytes of js")
