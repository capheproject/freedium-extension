import math, struct, zlib, sys
out = sys.argv[1]
GREEN = (174, 214, 167)
INK = (20, 20, 18)

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx-ax, by-ay
    t = max(0, min(1, ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy)))
    return math.hypot(px-ax-t*dx, py-ay-t*dy)

def rrect_inside(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0+r), x1-r); cy = min(max(y, y0+r), y1-r)
    return math.hypot(x-cx, y-cy) <= r

# Design in a 128-unit space
SEGS = [(34, 64, 94, 64), (94, 64, 70, 40), (94, 64, 70, 88)]
STROKE = 7  # half-width

def sample(x, y):
    if not rrect_inside(x, y, 4, 4, 124, 124, 30):
        return None
    if any(seg_dist(x, y, *s) <= STROKE for s in SEGS):
        return INK
    return GREEN

def render(size, ss=6):
    rows = []
    k = 128 / size
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            r = g = b = a = 0
            for sj in range(ss):
                for si in range(ss):
                    c = sample((i + (si+.5)/ss) * k, (j + (sj+.5)/ss) * k)
                    if c: r += c[0]; g += c[1]; b += c[2]; a += 1
            n = ss*ss
            row += bytes([r//a, g//a, b//a, round(255*a/n)] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    raw = b"".join(rows)
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t+d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

for s in (16, 32, 48, 128):
    open(f"{out}/icon{s}.png", "wb").write(render(s))
