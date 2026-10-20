#!/usr/bin/env python3
"""Render printed recipe-card PNGs for photo import evals."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PASTE = ROOT / "fixtures" / "paste"
PHOTO = ROOT / "fixtures" / "photo"
FONT_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
TITLE_FONT_PATH = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

CARDS = [
    "banana-bread.txt",
    "chicken-noodle-soup.txt",
    "skillet-pancakes.txt",
    "weeknight-chili.txt",
    "oatmeal-cookies.txt",
    "chicken-pot-pie.txt",
]


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        trial = " ".join([*current, word])
        if draw.textlength(trial, font=font) <= width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines or [""]


def render(text: str, dest: Path) -> None:
    width, height = 900, 1400
    image = Image.new("RGB", (width, height), "#fff8ef")
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(str(TITLE_FONT_PATH), 36)
    body_font = ImageFont.truetype(str(FONT_PATH), 24)
    y = 48
    max_width = width - 96
    for raw in text.splitlines():
        line = raw.rstrip()
        font = title_font if y == 48 else body_font
        if not line:
            y += 18
            continue
        for part in wrap(draw, line, font, max_width):
            x = 48
            gap = 12 if font is title_font else 8
            for word in part.split():
                draw.text((x, y), word, fill="#1a1a1a", font=font)
                x += int(draw.textlength(word, font=font)) + gap
            y += 44 if font is title_font else 34
    PHOTO.mkdir(parents=True, exist_ok=True)
    image.save(dest, "PNG")


def main() -> None:
    for name in CARDS:
        render((PASTE / name).read_text(), PHOTO / name.replace(".txt", ".png"))


if __name__ == "__main__":
    main()
