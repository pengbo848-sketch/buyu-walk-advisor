from PIL import Image, ImageDraw, ImageFilter
import math

def make_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), "#1B2430")
    draw = ImageDraw.Draw(img)

    # Dusk gradient background (indigo -> deep teal)
    top = (27, 36, 48)      # #1B2430
    bottom = (18, 46, 53)   # deep teal
    for y in range(size):
        t = y / size
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Safe zone for maskable icons: keep signature within center 66%
    margin = size * 0.17 if maskable else size * 0.08
    cx, cy = size / 2, size / 2 * (1.05 if not maskable else 1.0)

    # Glow layers (lantern effect) behind the moon
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    glow_r = size * 0.30
    for i in range(6, 0, -1):
        alpha = int(18 * i)
        rr = glow_r * (1 + i * 0.12)
        gdraw.ellipse(
            [cx - rr, cy - rr, cx + rr, cy + rr],
            fill=(232, 168, 85, alpha),
        )
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.03))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    draw = ImageDraw.Draw(img)

    # Core moon/lantern
    core_r = size * 0.155
    draw.ellipse(
        [cx - core_r, cy - core_r, cx + core_r, cy + core_r],
        fill=(245, 197, 129, 255),
    )
    inner_r = core_r * 0.55
    draw.ellipse(
        [cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r],
        fill=(255, 224, 178, 255),
    )

    # A simple footpath: two curved dots trailing below, suggesting a walk
    path_color = (124, 141, 166, 200)
    for i, t in enumerate([0.30, 0.20, 0.12]):
        px = cx - size * (0.16 - i * 0.06)
        py = cy + size * (0.30 + i * 0.10)
        pr = size * (0.018 + i * 0.006)
        draw.ellipse([px - pr, py - pr, px + pr, py + pr], fill=path_color)

    return img.convert("RGB")

make_icon(192).save("icon-192.png")
make_icon(512).save("icon-512.png")
make_icon(512, maskable=True).save("icon-512-maskable.png")
print("done")
