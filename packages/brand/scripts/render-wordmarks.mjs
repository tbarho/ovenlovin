/**
 * Rasterize Bagel Fat One wordmarks for GitHub/OG (no webfonts there).
 *
 *   BAGEL_TTF=/path/to/bagel.ttf node packages/brand/scripts/render-wordmarks.mjs
 *
 * Does not embed the TTF in the repo. Live apps load Bagel Fat One via next/font.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");
const fontPath = process.env.BAGEL_TTF ?? "/tmp/ol-fonts/bagel.ttf";
const markUrl = pathToFileURL(join(assets, "mark.png")).href;
const fontFace = `@font-face{font-family:'Bagel Fat One';src:url('${pathToFileURL(fontPath).href}') format('truetype');font-weight:400;font-style:normal;font-display:block;}`;

const INK = "#161310";
const CREAM = "#FFF8F2";
const DARK = "#161310";

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
${fontFace}
html,body{margin:0;background:transparent;}
.word{font-family:'Bagel Fat One',cursive;font-weight:400;line-height:1;white-space:nowrap;letter-spacing:0;}
#wordmark,#wordmark-dark{display:inline-block;padding:12px 16px;}
#wordmark{color:${INK};font-size:128px;}
#wordmark-dark{color:${CREAM};font-size:128px;}
#lockup{display:inline-flex;flex-direction:column;align-items:center;gap:18px;padding:28px 32px;}
#lockup img{width:168px;height:168px;}
#lockup .word{color:${INK};font-size:72px;}
#og,#og-dark{width:1200px;height:630px;display:flex;align-items:center;justify-content:center;gap:48px;box-sizing:border-box;padding:48px 72px;}
#og{background:${CREAM};}
#og-dark{background:${DARK};}
#og img,#og-dark img{width:280px;height:280px;}
#og .word{color:${INK};font-size:92px;}
#og-dark .word{color:${CREAM};font-size:92px;}
</style>
</head>
<body>
  <div id="wordmark" class="word">OvenLovin</div>
  <div id="wordmark-dark" class="word">OvenLovin</div>
  <div id="lockup">
    <img src="${markUrl}" alt="" />
    <div class="word">OvenLovin</div>
  </div>
  <div id="og">
    <img src="${markUrl}" alt="" />
    <div class="word">OvenLovin</div>
  </div>
  <div id="og-dark">
    <img src="${markUrl}" alt="" />
    <div class="word">OvenLovin</div>
  </div>
</body>
</html>`;

const outHtml = join("/tmp/ol-fonts", "render-wordmarks.html");
mkdirSync("/tmp/ol-fonts", { recursive: true });
writeFileSync(outHtml, html);

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1400, height: 900 },
});
await page.goto(pathToFileURL(outHtml).href, { waitUntil: "networkidle" });
await page.evaluate(async () => document.fonts.ready);

async function shot(id, file, omitBackground) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: join(assets, file), omitBackground, type: "png" });
  console.log("wrote", file);
}

await shot("wordmark", "wordmark.png", true);
await shot("wordmark-dark", "wordmark-dark.png", true);
await shot("lockup", "lockup.png", true);
await page.setViewportSize({ width: 1200, height: 630 });
await shot("og", "og.png", false);
await shot("og-dark", "og-dark.png", false);
await browser.close();

const copies = [
  join(root, "../../apps/web/public/brand"),
  join(root, "../../apps/docs/public/brand"),
];
for (const dest of copies) {
  for (const file of ["wordmark.png", "wordmark-dark.png", "lockup.png", "og.png", "og-dark.png"]) {
    copyFileSync(join(assets, file), join(dest, file));
  }
  for (const stale of ["wordmark.svg", "wordmark-dark.svg"]) {
    rmSync(join(dest, stale), { force: true });
  }
}

console.log("copied to web/docs public/brand");
console.log("font bytes", readFileSync(fontPath).length);
