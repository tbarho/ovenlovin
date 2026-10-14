# @ovenlovin/brand

Shared OvenLovin logo, wordmark, and social images.

The mark is Ty's illustrated toaster oven — a red oven with a heart-shaped bun — in the same isolated-object spirit as [barrito](https://tbarho.github.io/barrito/). It is a PNG (the source is a 3D render; an SVG trace would not stay faithful). The same mark reads on light and dark backgrounds.

The wordmark is the single word **OvenLovin** (capital O, capital L, no space) set in [Fascinate Inline](https://fonts.google.com/specimen/Fascinate+Inline). Live apps load the face with `next/font`; static PNGs are rasterized for GitHub and Open Graph, which cannot load webfonts. Body copy stays Geist.

## Assets

| File | Use |
| --- | --- |
| `assets/mark.png` | Logo mark (transparent, 512px) |
| `assets/wordmark.png` | Wordmark on light backgrounds |
| `assets/wordmark-dark.png` | Wordmark on dark backgrounds |
| `assets/lockup.png` | Stacked mark + wordmark (README) |
| `assets/favicon.svg` | SVG favicon wrapping a 64px PNG |
| `assets/favicon-32.png` / `favicon-16.png` / `favicon.ico` | Raster favicons |
| `assets/apple-touch-icon.png` | 180×180 home-screen icon |
| `assets/og.png` | Open Graph card — Fascinate wordmark, pitch, product shot (white) |
| `assets/og-dark.png` | Open Graph card on ink |

Served copies live at:

- `apps/web/public/brand/` — deployed app
- `apps/docs/public/brand/` — documentation site

Use the public paths from `brandPublicPath` (`/brand/mark.png`, `/brand/wordmark.png`, …) in the Next.js apps.

To regenerate the raster wordmarks after a font change:

```bash
FONT_TTF=/path/to/FascinateInline-Regular.ttf \
GEIST_TTF=/path/to/Geist-Regular.ttf \
node packages/brand/scripts/render-wordmarks.mjs --og-only
```
