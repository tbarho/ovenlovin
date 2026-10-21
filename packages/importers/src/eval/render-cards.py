#!/usr/bin/env python3
"""Render phone-camera-style JPEG eval photos from the paste fixtures.

Printed cards get a desk, perspective warp, uneven light, and JPEG compression.
Ginger snaps is lined-paper handwriting (per-letter jitter). Weeknight chili is
a two-column cookbook page. Not real camera captures; made to look like them.
"""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
PASTE = ROOT / "fixtures" / "paste"
PHOTO = ROOT / "fixtures" / "photo"
SERIF = Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf")
SERIF_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")
SANS = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")

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
    speckle = Image.effect_noise(size, 18).convert("RGB")
    return Image.blend(image, speckle, 0.08)


def draw_text_block(
    image: Image.Image,
    text: str,
    *,
    title_size: int = 36,
    body_size: int = 22,
    margin: int = 56,
    fill: str = "#1c1914",
) -> None:
    draw = ImageDraw.Draw(image)
    title_font = font(SERIF_BOLD, title_size)
    body_font = font(SERIF, body_size)
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


def handwriting(text: str) -> Image.Image:
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
        used = font(SERIF, 34 if i == 0 else 26)
        x = 70 + rng.randint(0, 16)
        for word in line.split(" "):
            draw.text((x, y + rng.uniform(-1.5, 1.5)), word, fill="#1a2744", font=used)
            x += int(draw.textlength(word + " ", font=used)) + rng.randint(0, 3)
        y += 48
    return image


def cookbook_columns(text: str) -> Image.Image:
    width, height = 1600, 1200
    image = paper((width, height), "#f7f1e4")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, 88), fill="#3d2a1c")
    title = text.splitlines()[0]
    draw.text((48, 24), title, fill="#f3e6d0", font=font(SERIF_BOLD, 36))
    draw.text((width - 420, 32), "WEEKNIGHT DINNERS  ·  p. 18", fill="#d9c4a6", font=font(SANS, 18))
    body = [line for line in text.splitlines()[1:] if line.strip()]
    split = next((i for i, line in enumerate(body) if line.lower().startswith("instructions")), 8)
    left, right = body[:split], body[split:]
    for lines, x0 in ((left, 64), (right, 860)):
        y = 130
        used = font(SERIF, 24)
        for line in lines:
            for part in wrap(draw, line, used, 640):
                draw.text((x0, y), part, fill="#241910", font=used)
                y += 34
            y += 6
    draw.line((800, 110, 800, height - 40), fill="#c8b79a", width=2)
    return image


def phone_shot(card: Image.Image, seed: int) -> Image.Image:
    rng = random.Random(seed)
    desk = Image.new("RGB", (1800, 1400), "#5a4030")
    wood = Image.effect_noise(desk.size, 28).convert("RGB")
    desk = Image.blend(desk, wood, 0.18)
    desk = ImageEnhance.Color(desk).enhance(0.35)
    fitted = ImageOps.contain(card, (1280, 1180))
    pad = Image.new("RGB", (fitted.width + 28, fitted.height + 28), "#efe6d4")
    pad.paste(fitted, (14, 14))
    tilted = pad.rotate(rng.uniform(-5, 5), resample=Image.Resampling.BICUBIC, expand=True, fillcolor="#5a4030")
    x = (desk.width - tilted.width) // 2 + rng.randint(-36, 36)
    y = (desk.height - tilted.height) // 2 + rng.randint(-28, 28)
    desk.paste(tilted, (x, y))
    lamp = Image.new("L", desk.size, 0)
    ImageDraw.Draw(lamp).ellipse(
        (desk.width * 0.08, -80, desk.width * 0.92, desk.height * 0.85),
        fill=255,
    )
    lamp = lamp.filter(ImageFilter.GaussianBlur(90))
    lit = ImageEnhance.Brightness(desk).enhance(1.08)
    desk = Image.composite(lit, ImageEnhance.Brightness(desk).enhance(0.82), lamp)
    desk = ImageEnhance.Color(desk).enhance(0.93)
    return desk.filter(ImageFilter.GaussianBlur(0.35))


def save_jpeg(image: Image.Image, dest: Path) -> None:
    PHOTO.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(dest, "JPEG", quality=78, optimize=True)


def main() -> None:
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
            card = handwriting(text)
        elif name == "weeknight-chili":
            card = cookbook_columns(text)
        else:
            card = paper((1000, 1500), "#fff7ea")
            draw_text_block(card, text)
        save_jpeg(phone_shot(card, seed=11 + i), PHOTO / f"{name}.jpg")
        png = PHOTO / f"{name}.png"
        if png.exists():
            png.unlink()


if __name__ == "__main__":
    main()
