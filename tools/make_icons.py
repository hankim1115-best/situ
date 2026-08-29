"""Generate PWA icons with the standard library only (no Pillow).

Writes indigo speech-bubble icons into ../assets/.
Run:  py tools/make_icons.py
"""
import os
import struct
import zlib

BRAND_TOP = (67, 56, 202)   # #4338CA
BRAND_BOT = (99, 102, 241)  # #6366F1
WHITE = (255, 255, 255)

OUT = os.path.join(os.path.dirname(__file__), "..", "assets")


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def write_png(path, size, rgba):
    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter: none
        raw.extend(rgba[y * stride:(y + 1) * stride])
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def render(size, inset):
    """Render at 2x then box-downsample for cheap anti-aliasing.

    inset: fraction of the canvas kept clear around the bubble (bigger = more
    padding, used for the maskable variant safe zone).
    """
    S = size * 2
    buf = bytearray(S * S * 4)

    # background gradient (top -> bottom)
    for y in range(S):
        col = lerp(BRAND_TOP, BRAND_BOT, y / (S - 1))
        buf[y * S * 4:(y + 1) * S * 4] = bytes((col[0], col[1], col[2], 255)) * S

    def put(x, y, rgb):
        if 0 <= x < S and 0 <= y < S:
            i = (y * S + x) * 4
            buf[i] = rgb[0]
            buf[i + 1] = rgb[1]
            buf[i + 2] = rgb[2]
            buf[i + 3] = 255

    m = S * inset
    x0, y0, x1, y1 = m, m * 0.92, S - m, S - m * 1.35
    r = S * 0.13

    # rounded-rectangle bubble body
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            cx = min(max(x, x0 + r), x1 - 1 - r)
            cy = min(max(y, y0 + r), y1 - 1 - r)
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r * r:
                put(x, y, WHITE)

    # tail (triangle hanging from the bottom-left)
    tail_h = int(S * 0.14)
    tail_x = int(x0 + (x1 - x0) * 0.22)
    for i in range(tail_h):
        w = tail_h - i
        for x in range(tail_x, tail_x + w):
            put(x, int(y1) + i, WHITE)

    # three "typing" dots
    dot_r = int(S * 0.042)
    cy = int((y0 + y1) / 2)
    span = (x1 - x0) * 0.24
    for dx in (-span, 0.0, span):
        cx = int((x0 + x1) / 2 + dx)
        for y in range(cy - dot_r, cy + dot_r):
            for x in range(cx - dot_r, cx + dot_r):
                if (x - cx) ** 2 + (y - cy) ** 2 <= dot_r * dot_r:
                    put(x, y, BRAND_BOT)

    # downsample 2x -> size
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            for dy in range(2):
                base = ((2 * y + dy) * S + 2 * x) * 4
                for dx in range(2):
                    j = base + dx * 4
                    acc[0] += buf[j]
                    acc[1] += buf[j + 1]
                    acc[2] += buf[j + 2]
                    acc[3] += buf[j + 3]
            i = (y * size + x) * 4
            out[i] = acc[0] // 4
            out[i + 1] = acc[1] // 4
            out[i + 2] = acc[2] // 4
            out[i + 3] = acc[3] // 4
    return bytes(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, 0.17),
        ("icon-512.png", 512, 0.17),
        ("icon-maskable-192.png", 192, 0.26),
        ("icon-maskable-512.png", 512, 0.26),
        ("apple-touch-icon.png", 180, 0.17),
        ("favicon-32.png", 32, 0.14),
    ]
    for name, size, inset in jobs:
        write_png(os.path.join(OUT, name), size, render(size, inset))
        print("wrote", name)


if __name__ == "__main__":
    main()
