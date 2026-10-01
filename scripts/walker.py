# Renders assets/walker-{dark,light}.svg: a little figure that waves "hii!",
# walks across the strip under a tracking box, says thanks, and walks back.
# SMIL only (GitHub shows SVGs through <img>, where CSS animations stay frozen).
# Run: python3 scripts/walker.py
DUR = 16.0
WAVE1, WALK1, PAUSE, WALK2 = (0, .15), (.15, .5), (.5, .6), (.6, .95)  # loop fractions
W, H, X0, X1, FEET = 1200, 170, 90, 1060, 140
STEP = 0.25 / DUR  # quarter-second beats

inside = lambda t, p: p[0] <= t < p[1]
walking = lambda t: inside(t, WALK1) or inside(t, WALK2)
beat = lambda t: round(t / STEP) % 2


def leg(sign):
    return lambda t: sign * (24 if beat(t) else -24) if walking(t) else sign * 8


def arm(t):
    if inside(t, WAVE1) or inside(t, PAUSE):
        return -150 if beat(t) else -115
    return (22 if beat(t) else -22) if walking(t) else 8


def rot(fn, cx, cy):
    n = round(1 / STEP)
    ks = [round(i * STEP, 4) for i in range(n)]
    vals = ";".join(f"{fn(k)} {cx} {cy}" for k in ks)
    return (f'<animateTransform attributeName="transform" type="rotate" values="{vals}" '
            f'keyTimes="{";".join(map(str, ks))}" dur="{DUR}s" calcMode="discrete" repeatCount="indefinite"/>')


def show(a, b):
    v, k = ("1;0", f"0;{b}") if a == 0 else ("0;1;0", f"0;{a};{b}")
    return f'<animate attributeName="opacity" values="{v}" keyTimes="{k}" dur="{DUR}s" calcMode="discrete" repeatCount="indefinite"/>'


def svg(bg, fg, muted, border, accent):
    mono = 'font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="13" letter-spacing="2"'
    line = lambda x1, y1, x2, y2: f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{fg}" stroke-width="3" stroke-linecap="round"/>'
    bracket = lambda d: f'<path d="{d}" fill="none" stroke="{accent}" stroke-width="1.5"/>'
    ticks = "".join(f'<line x1="{x}" y1="{FEET}" x2="{x}" y2="{FEET + (8 if x % 200 == 40 else 4)}" stroke="{border}"/>'
                    for x in range(40, W - 39, 40))

    figure = f'''
      <g>{rot(leg(1), 0, -22)}{line(0, -22, 0, 0)}</g>
      <g>{rot(leg(-1), 0, -22)}{line(0, -22, 0, 0)}</g>
      <rect x="-7" y="-44" width="14" height="24" rx="3" fill="{accent}"/>
      <g>{rot(arm, 0, -40)}{line(0, -40, 0, -24)}</g>
      <circle cx="0" cy="-54" r="10" fill="{fg}"/>
      <rect x="1" y="-57" width="6" height="4" rx="1" fill="none" stroke="{bg}" stroke-width="1.4"/>
      <rect x="-6" y="-57" width="6" height="4" rx="1" fill="none" stroke="{bg}" stroke-width="1.4"/>'''

    def bubble(text, end, a, b):
        w = len(text) * 9.6 + 20
        x, tx, anchor = (-w - 6, -16, "end") if end else (6, 16, "start")
        return (f'<g opacity="{1 if a == 0 else 0}">{show(a, b)}'
                f'<rect x="{x}" y="-104" width="{w}" height="26" fill="{bg}" stroke="{fg}"/>'
                f'<text x="{tx}" y="-86" {mono} fill="{fg}" text-anchor="{anchor}">{text}</text></g>')

    L, T, R, B, s = -26, -72, 26, 6, 7
    path = ";".join(f"{x} {FEET}" for x in (X0, X0, X1, X1, X0, X0))
    keys = f"0;{WALK1[0]};{WALK1[1]};{WALK2[0]};{WALK2[1]};1"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="A small figure waves hello and walks across the profile">
  <rect width="{W}" height="{H}" fill="{bg}"/>
  <line x1="40" y1="{FEET}" x2="{W - 40}" y2="{FEET}" stroke="{border}"/>{ticks}
  <text x="40" y="24" {mono} fill="{muted}"><tspan fill="{fg}">[00]</tspan>  LOBBY CAM</text>
  <text x="{W - 40}" y="24" {mono} fill="{accent}" text-anchor="end">● REC</text>
  <g transform="translate({X0} {FEET})">
    <animateTransform attributeName="transform" type="translate" values="{path}" keyTimes="{keys}" dur="{DUR}s" repeatCount="indefinite"/>
    <g>
      <animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" keyTimes="0;0.55;0.97" dur="{DUR}s" calcMode="discrete" repeatCount="indefinite"/>
      {figure}
    </g>
    {bracket(f"M{L} {T+s} V{T} H{L+s}")}{bracket(f"M{R-s} {T} H{R} V{T+s}")}{bracket(f"M{L} {B-s} V{B} H{L+s}")}{bracket(f"M{R-s} {B} H{R} V{B-s}")}
    {bubble("hii!", False, 0, WAVE1[1])}
    {bubble("thanks for stopping by", True, PAUSE[0], PAUSE[1])}
  </g>
</svg>
'''


open("assets/walker-dark.svg", "w").write(svg("#0b0b0c", "#ececea", "#7c7c77", "#242427", "#ff4a2b"))
open("assets/walker-light.svg", "w").write(svg("#f3f3f1", "#0d0d0d", "#6f6f6a", "#d6d6d1", "#ff3b1f"))
