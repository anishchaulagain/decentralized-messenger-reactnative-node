"""Generate the Dipanix app icon set from the brand palette.

Produces a "D" monogram in a blue->purple gradient on a dark obsidian
background, matching the Lumina splash screen aesthetic.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, "assets", "images")
FONT_PATH = os.path.join(
    ROOT, "node_modules", "@expo-google-fonts", "inter",
    "800ExtraBold", "Inter_800ExtraBold.ttf",
)

S = 1024  # master canvas size

# Brand colors
BG_TL = (22, 27, 36)     # #161b24 obsidian (top-left)
BG_BR = (8, 11, 16)      # #080b10 deep (bottom-right)
GLYPH_TL = (110, 168, 255)   # #6ea8ff light blue
GLYPH_BR = (176, 140, 255)   # #b08cff light purple
GLOW = (77, 142, 255)        # #4d8eff primary glow


def diagonal_gradient(size, c0, c1):
    """Diagonal (TL->BR) linear gradient as an RGB array."""
    n = size
    ax = np.linspace(0.0, 1.0, n)
    # t in [0,1] along the main diagonal
    t = (ax[None, :] + ax[:, None]) / 2.0
    out = np.zeros((n, n, 3), dtype=np.float64)
    for i in range(3):
        out[..., i] = c0[i] + (c1[i] - c0[i]) * t
    return out


def radial_glow(size, color, cx, cy, radius, strength):
    """Additive radial glow array (RGB float)."""
    n = size
    yy, xx = np.mgrid[0:n, 0:n]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    falloff = np.clip(1.0 - dist / radius, 0.0, 1.0) ** 2
    glow = np.zeros((n, n, 3), dtype=np.float64)
    for i in range(3):
        glow[..., i] = color[i] * falloff * strength
    return glow


def glyph_mask(size, char, scale, font_path, dy=0):
    """Anti-aliased alpha mask of `char` centered, height ~= scale*size."""
    big = size * 2  # supersample
    target_h = scale * big
    fsize = int(target_h * 1.35)
    font = ImageFont.truetype(font_path, fsize)
    mask = Image.new("L", (big, big), 0)
    d = ImageDraw.Draw(mask)
    bbox = d.textbbox((0, 0), char, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (big - w) / 2 - bbox[0]
    y = (big - h) / 2 - bbox[1] + dy * 2
    d.text((x, y), char, font=font, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def build_background():
    base = diagonal_gradient(S, BG_TL, BG_BR)
    base += radial_glow(S, GLOW, S * 0.5, S * 0.42, S * 0.62, 0.18)
    base = np.clip(base, 0, 255).astype(np.uint8)
    return Image.fromarray(base, "RGB")


def gradient_glyph(mask):
    """RGBA image of the glyph filled with the brand gradient."""
    grad = diagonal_gradient(S, GLYPH_TL, GLYPH_BR).astype(np.uint8)
    glyph = Image.fromarray(grad, "RGB").convert("RGBA")
    glyph.putalpha(mask)
    return glyph


def compose_icon(with_background=True, scale=0.46, glow_under=True):
    mask = glyph_mask(S, "D", scale, FONT_PATH)
    if with_background:
        canvas = build_background().convert("RGBA")
    else:
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    if glow_under:
        # soft glow beneath the glyph
        glow_layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        g = Image.new("RGBA", (S, S), (77, 142, 255, 255))
        g.putalpha(mask)
        glow_layer = Image.alpha_composite(glow_layer, g)
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(28))
        canvas = Image.alpha_composite(canvas, glow_layer)

    canvas = Image.alpha_composite(canvas, gradient_glyph(mask))
    return canvas


def save(img, name, size=None, rgb=False):
    out = img
    if size:
        out = out.resize((size, size), Image.LANCZOS)
    if rgb:
        bg = Image.new("RGB", out.size, (8, 11, 16))
        bg.paste(out, mask=out.split()[-1] if out.mode == "RGBA" else None)
        out = bg
    out.save(os.path.join(IMAGES, name))
    print("wrote", name, out.size)


# --- Main app icon (full-bleed dark bg + gradient D) ---
icon = compose_icon(with_background=True, scale=0.46)
save(icon, "icon.png", rgb=True)

# --- Web favicon ---
save(icon, "favicon.png", size=196, rgb=True)

# --- Android adaptive background (dark gradient, full) ---
save(build_background(), "android-icon-background.png")

# --- Android adaptive foreground (D within safe zone, transparent) ---
# Safe zone is the center ~66%; keep the glyph small & centered.
fg = compose_icon(with_background=False, scale=0.34, glow_under=True)
save(fg, "android-icon-foreground.png")

# --- Android monochrome (white D, transparent) ---
mono_mask = glyph_mask(S, "D", 0.34, FONT_PATH)
mono = Image.new("RGBA", (S, S), (255, 255, 255, 0))
white = Image.new("RGBA", (S, S), (255, 255, 255, 255))
white.putalpha(mono_mask)
save(white, "android-icon-monochrome.png")

# --- Native splash icon (gradient D, transparent, for expo-splash-screen) ---
splash = compose_icon(with_background=False, scale=0.62, glow_under=True)
save(splash, "splash-icon.png", size=512)

print("done")
