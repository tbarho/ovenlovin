#!/usr/bin/env python3
"""Render phone-camera-style JPEG eval photos from the paste fixtures.

Fonts are OFL, fetched at render time (no /usr/share/fonts). Ginger snaps is
handwritten. Tomato pasta is a stained/creased card. Chili is a cookbook page
with curl. The rest are printed cards with perspective, shadow, and uneven light.
"""

from __future__ import annotations

import random
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
PASTE = ROOT / "fixtures" / "paste"
PHOTO = ROOT / "fixtures" / "photo"
FONT_DIR = PHOTO / ".fonts"

HAND_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/patrickhand/PatrickHand-Regular.ttf"
SERIF_URL = "https://github.com/adobe-fonts/source-serif/raw/release/TTF/SourceSerif4-Regular.ttf"
SERIF_BOLD_URL = "https://github.com/adobe-fonts/source-serif/raw/release/TTF/SourceSerif4-Bold.ttf"

TOMATO = """Weeknight Tomato Pasta
Weeknight Dinners, p. 42

Serves 4

Ingredients
12 oz pasta
1 jar crushed tomatoes
2 tbsp olive oil
1/2 cup grated parmesan

Instructions
1. Boil pasta in salted water until al dente.
2. Warm tomatoes with olive oil.
3. Toss pasta with sauce and parmesan.

Salt the pasta water well.
"""

GINGER = """Grandma's Ginger Snaps
Makes 48

3/4 c. shortening
1 c. sugar
1 egg
1/4 c. molasses
2 c. flour
2 tsp. baking soda
1 tsp. cinnamon
1 tsp. cloves
1 tsp. ginger

Mix shortening, sugar, egg and molasses thoroughly.
Sift together flour, baking soda, and spices; blend in.
Chill dough.
Roll into balls the size of large walnuts.
Dip tops in sugar.
Place sugar side up on greased baking sheet.
Bake 10-12 min. at 375°.
"""


def fetch_font(url: str, name: str) -> Path:
    dest = FONT_DIR / name
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": "ovenlovin-eval-fonts"})
    with urllib.request.urlopen(req, timeout=30) as response:
        dest.write_bytes(response.read())
    return dest


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, used: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join([*current, word])
        if draw.textlength(trial, font=used) <= width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines or [""]


def paper(size: tuple[int, int], color: str) -> Image.Image:
    image = Image.new("RGB", size, color)
    speckle = Image.effect_noise(size, 22).convert("RGB")
    return Image.blend(image, speckle, 0.12)


def stain_and_crease(image: Image.Image, rng: random.Random) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for _ in range(5):
        x0 = rng.randint(20, image.width - 220)
        y0 = rng.randint(40, image.height - 220)
        x1 = x0 + rng.randint(120, 280)
        y1 = y0 + rng.randint(80, 200)
        draw.ellipse((x0, y0, x1, y1), fill=(132, 86, 40, rng.randint(50, 80)))
        draw.ellipse((x0 + 10, y0 + 10, x1 - 10, y1 - 10), outline=(90, 55, 25, 90), width=6)
    for _ in range(3):
        x = rng.randint(80, image.width - 80)
        draw.line((x, 10, x + rng.randint(-40, 40), image.height - 10), fill=(90, 60, 35, 70), width=3)
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def draw_text_block(
    image: Image.Image,
    text: str,
    serif: Path,
    serif_bold: Path,
    *,
    title_size: int = 36,
    body_size: int = 22,
    margin: int = 56,
    fill: str = "#1c1914",
) -> None:
    draw = ImageDraw.Draw(image)
    title_font = font(serif_bold, title_size)
    body_font = font(serif, body_size)
    y = margin
    max_width = image.width - margin * 2
    for i, raw in enumerate(text.splitlines()):
        line = raw.rstrip()
        used = title_font if i == 0 else body_font
        if not line:
            y += 14
            continue
        for part in wrap(draw, line, used, max_width):
            draw.text((margin, y), part, fill=fill, font=used)
            y += 46 if used is title_font else 32


def handwriting(text: str, hand: Path) -> Image.Image:
    width, height = 1100, 1500
    image = paper((width, height), "#f4ecd4")
    draw = ImageDraw.Draw(image)
    for y in range(120, height - 40, 48):
        draw.line((60, y, width - 60, y), fill="#c9d4de", width=1)
    rng = random.Random(7)
    y = 88
    for i, raw in enumerate(text.splitlines()):
        line = raw.rstrip()
        if not line:
            y += 28
            continue
        used = font(hand, 42 if i == 0 else 32)
        x = 70 + rng.randint(0, 28)
        for word in line.split(" "):
            draw.text((x, y + rng.uniform(-5, 5)), word, fill="#1a2744", font=used)
            x += int(draw.textlength(word + " ", font=used)) + rng.randint(0, 5)
        y += 52 + rng.randint(-3, 6)
    return stain_and_crease(image, rng)


def cookbook_columns(text: str, serif: Path, serif_bold: Path) -> Image.Image:
    width, height = 1600, 1200
    image = paper((width, height), "#f7f1e4")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 88), fill="#3d2a1c")
    title = text.splitlines()[0]
    draw.text((48, 24), title, fill="#f3e6d0", font=font(serif_bold, 36))
    draw.text((width - 420, 32), "WEEKNIGHT DINNERS  ·  p. 18", fill="#d9c4a6", font=font(serif, 18))
    body = [line for line in text.splitlines()[1:] if line.strip()]
    split = next((i for i, line in enumerate(body) if line.lower().startswith("instructions")), 8)
    left, right = body[:split], body[split:]
    for lines, x0 in ((left, 64), (right, 860)):
        y = 130
        used = font(serif, 24)
        for line in lines:
            for part in wrap(draw, line, used, 640):
                draw.text((x0, y), part, fill="#241910", font=used)
                y += 34
            y += 6
    # spine + page curl
    spine = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(spine).rectangle((784, 88, 816, height), fill=(50, 30, 16, 90))
    image = Image.alpha_composite(image.convert("RGBA"), spine).convert("RGB")
    curl = Image.new("RGBA", image.size, (0, 0, 0, 0))
    c = ImageDraw.Draw(curl)
    c.polygon(
        [(width - 220, height), (width, height - 210), (width, height)],
        fill=(58, 36, 22, 160),
    )
    c.polygon(
        [(width - 200, height - 8), (width - 8, height - 190), (width - 8, height - 8)],
        fill=(255, 246, 226, 200),
    )
    return Image.alpha_composite(image.convert("RGBA"), curl).convert("RGB")


def perspective(image: Image.Image, rng: random.Random, fill: str) -> Image.Image:
    tilted = image.rotate(rng.uniform(-16, 16), resample=Image.Resampling.BICUBIC, expand=True, fillcolor=fill)
    w, h = tilted.size
    shear = rng.uniform(-0.24, 0.24)
    out_w = max(1, int(w + abs(shear) * h))
    return tilted.transform(
        (out_w, h),
        Image.Transform.AFFINE,
        (1, shear, 0, rng.uniform(-0.04, 0.04), 1, 0),
        resample=Image.Resampling.BICUBIC,
        fillcolor=fill,
    )


def phone_shot(card: Image.Image, seed: int) -> Image.Image:
    rng = random.Random(seed)
    desk = Image.new("RGB", (1800, 1400), "#4a3428")
    wood = Image.effect_noise(desk.size, 36).convert("RGB")
    desk = Image.blend(desk, wood, 0.22)
    desk = ImageEnhance.Color(desk).enhance(0.3)
    fitted = ImageOps.contain(card, (1180, 1080))
    warped = perspective(fitted, rng, "#4a3428")
    shadow = Image.new("RGBA", desk.size, (0, 0, 0, 0))
    sx = (desk.width - warped.width) // 2 + rng.randint(-80, 80) + 22
    sy = (desk.height - warped.height) // 2 + rng.randint(-60, 60) + 28
    ImageDraw.Draw(shadow).rectangle(
        (sx, sy, sx + warped.width, sy + warped.height), fill=(0, 0, 0, 120)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    desk = Image.alpha_composite(desk.convert("RGBA"), shadow).convert("RGB")
    x = sx - 22
    y = sy - 28
    desk.paste(warped, (x, y))
    lamp = Image.new("L", desk.size, 0)
    ImageDraw.Draw(lamp).ellipse(
        (-80, -200, desk.width * 0.75, desk.height * 0.7),
        fill=255,
    )
    lamp = lamp.filter(ImageFilter.GaussianBlur(120))
    lit = ImageEnhance.Brightness(desk).enhance(1.16)
    dark = ImageEnhance.Brightness(desk).enhance(0.62)
    desk = Image.composite(lit, dark, lamp)
    desk = ImageEnhance.Color(desk).enhance(0.88)
    desk = desk.filter(ImageFilter.GaussianBlur(0.7))
    return ImageEnhance.Contrast(desk).enhance(0.94)


def save_jpeg(image: Image.Image, dest: Path) -> None:
    PHOTO.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(dest, "JPEG", quality=70, optimize=True)


def main() -> None:
    hand = fetch_font(HAND_URL, "PatrickHand-Regular.ttf")
    serif = fetch_font(SERIF_URL, "SourceSerif4-Regular.ttf")
    serif_bold = fetch_font(SERIF_BOLD_URL, "SourceSerif4-Bold.ttf")
    cards = {
        "printed-tomato-pasta": TOMATO,
        "banana-bread": (PASTE / "banana-bread.txt").read_text(),
        "chicken-noodle-soup": (PASTE / "chicken-noodle-soup.txt").read_text(),
        "skillet-pancakes": (PASTE / "skillet-pancakes.txt").read_text(),
        "oatmeal-cookies": (PASTE / "oatmeal-cookies.txt").read_text(),
        "chicken-pot-pie": (PASTE / "chicken-pot-pie.txt").read_text(),
        "weeknight-chili": (PASTE / "weeknight-chili.txt").read_text(),
        "handwritten-ginger-snaps": GINGER,
    }
    for i, (name, text) in enumerate(cards.items()):
        if name == "handwritten-ginger-snaps":
            card = handwriting(text, hand)
        elif name == "weeknight-chili":
            card = cookbook_columns(text, serif, serif_bold)
        else:
            card = paper((1000, 1500), "#fff7ea")
            draw_text_block(card, text, serif, serif_bold)
            if name == "printed-tomato-pasta":
                card = stain_and_crease(card, random.Random(3))
        save_jpeg(phone_shot(card, seed=11 + i), PHOTO / f"{name}.jpg")
        png = PHOTO / f"{name}.png"
        if png.exists():
            png.unlink()


if __name__ == "__main__":
    main()
