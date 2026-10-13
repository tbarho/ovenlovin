# @ovenlovin/brand

Shared OvenLovin logo, wordmark, and social images.

The mark is Ty's illustrated toaster oven — a red oven with a heart-shaped bun — in the same isolated-object spirit as [barrito](https://tbarho.github.io/barrito/). It is a PNG (the source is a 3D render; an SVG trace would not stay faithful). The same mark reads on light and dark backgrounds. Wordmarks invert.

## Assets

| File | Use |
| --- | --- |
| `assets/mark.png` | Logo mark (transparent, 512px) |
| `assets/wordmark.svg` | Wordmark on light backgrounds |
| `assets/wordmark-dark.svg` | Wordmark on dark backgrounds |
| `assets/favicon.svg` | SVG favicon wrapping a 64px PNG |
| `assets/favicon-32.png` / `favicon-16.png` / `favicon.ico` | Raster favicons |
| `assets/apple-touch-icon.png` | 180×180 home-screen icon |
| `assets/og.png` | Open Graph image (light) |
| `assets/og-dark.png` | Open Graph image (dark) |

Served copies live at:

- `apps/web/public/brand/` — deployed app
- `apps/docs/public/brand/` — documentation site

Use the public paths from `brandPublicPath` (`/brand/mark.png`, `/brand/wordmark.svg`, …) in the Next.js apps.
