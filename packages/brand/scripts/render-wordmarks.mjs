/**
 * Rasterize Fascinate Inline wordmarks and share cards (GitHub/OG cannot load webfonts).
 *
 *   FONT_TTF=/path/to/FascinateInline-Regular.ttf \
 *   GEIST_TTF=/path/to/Geist-Regular.ttf \
 *   PLAYWRIGHT_MODULE=/path/to/playwright \
 *   node packages/brand/scripts/render-wordmarks.mjs
 *
 * Does not embed the TTF in the repo. Live apps load Fascinate Inline via next/font.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const assets = join(root, "assets");
const fontFamily = process.env.FONT_FAMILY ?? "Fascinate Inline";
const fontPath =
  process.env.FONT_TTF ?? process.env.FASCINATE_TTF ?? "/tmp/ol-fonts/FascinateInline-Regular.ttf";
const geistPath = process.env.GEIST_TTF ?? "/tmp/ol-fonts/Geist-Regular.ttf";
const markUrl = pathToFileURL(join(assets, "mark.png")).href;
const shotUrl = pathToFileURL(join(repo, "docs/assets/kitchen-recipe.png")).href;
const PITCH = "The family recipe box your AI can actually use, and it knows who can't eat what.";

const fontFace = [
  `@font-face{font-family:'${fontFamily}';src:url('${pathToFileURL(fontPath).href}') format('truetype');font-weight:400;font-style:normal;font-display:block;}`,
  `@font-face{font-family:'Geist';src:url('${pathToFileURL(geistPath).href}') format('truetype');font-weight:400;font-style:normal;font-display:block;}`,
].join("");

const INK = "#161310";
const CREAM = "#FFF8F2";
const WHITE = "#ffffff";
const MUTED = "#5c534c";
const DARK = "#161310";

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
${fontFace}
html,body{margin:0;background:transparent;}
.word{font-family:'${fontFamily}',cursive;font-weight:400;line-height:1;white-space:nowrap;letter-spacing:0.01em;}
#wordmark,#wordmark-dark{display:inline-block;padding:20px 24px;}
#wordmark{color:${INK};font-size:128px;}
#wordmark-dark{color:${CREAM};font-size:128px;}
#lockup{display:inline-flex;flex-direction:column;align-items:center;gap:18px;padding:28px 36px;}
#lockup img{width:168px;height:168px;}
#lockup .word{color:${INK};font-size:72px;}
.og{
  width:1200px;height:630px;box-sizing:border-box;
  display:flex;align-items:center;gap:40px;
  padding:48px 48px 48px 56px;
}
#og{background:${WHITE};}
#og-dark{background:${DARK};}
.copy{flex:0 0 388px;display:flex;flex-direction:column;gap:20px;min-width:0;}
.brandrow{display:flex;align-items:center;gap:14px;}
.brandrow img{width:68px;height:68px;}
.brandrow .word{font-size:42px;}
#og .word{color:${INK};}
#og-dark .word{color:${WHITE};}
.tagline{
  font-family:'Geist',ui-sans-serif,system-ui,sans-serif;
  font-size:25px;line-height:1.38;margin:0;font-weight:400;max-width:22ch;
}
#og .tagline{color:${INK};}
#og-dark .tagline{color:${CREAM};}
.kicker{
  font-family:'Geist',ui-sans-serif,system-ui,sans-serif;
  font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin:0;
}
#og .kicker{color:${MUTED};}
#og-dark .kicker{color:#c4b8ae;}
.shot{
  flex:1;align-self:stretch;min-width:0;
  display:flex;flex-direction:column;
  border-radius:16px;overflow:hidden;
  box-shadow:0 18px 50px rgba(22,19,16,0.12),0 0 0 1px rgba(22,19,16,0.06);
  background:#fff;
}
#og-dark .shot{box-shadow:0 18px 50px rgba(0,0,0,0.45),0 0 0 1px rgba(255,255,255,0.06);}
.chrome{
  height:28px;display:flex;align-items:center;gap:6px;padding:0 12px;
  background:#f6f5f3;border-bottom:1px solid #eceae6;flex:none;
}
#og-dark .chrome{background:#2a2420;border-bottom-color:#3a322c;}
.dot{width:8px;height:8px;border-radius:50%;background:#d8d2cb;}
#og-dark .dot{background:#5a514a;}
.frame{flex:1;min-height:0;overflow:hidden;background:#fff;}
.frame img{width:100%;height:100%;object-fit:cover;object-position:left top;display:block;}
</style>
</head>
<body>
  <div id="wordmark" class="word">OvenLovin</div>
  <div id="wordmark-dark" class="word">OvenLovin</div>
  <div id="lockup">
    <img src="${markUrl}" alt="" />
    <div class="word">OvenLovin</div>
  </div>
  <div id="og" class="og">
    <div class="copy">
      <div class="brandrow">
        <img src="${markUrl}" alt="" />
        <div class="word">OvenLovin</div>
      </div>
      <p class="kicker">Family kitchen</p>
      <p class="tagline">${PITCH}</p>
    </div>
    <div class="shot">
      <div class="chrome" aria-hidden="true"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
      <div class="frame"><img src="${shotUrl}" alt="" /></div>
    </div>
  </div>
  <div id="og-dark" class="og">
    <div class="copy">
      <div class="brandrow">
        <img src="${markUrl}" alt="" />
        <div class="word">OvenLovin</div>
      </div>
      <p class="kicker">Family kitchen</p>
      <p class="tagline">${PITCH}</p>
    </div>
    <div class="shot">
      <div class="chrome" aria-hidden="true"><i class="dot"></i><i class="dot"></i><i class="dot"></i></div>
      <div class="frame"><img src="${shotUrl}" alt="" /></div>
    </div>
  </div>
</body>
</html>`;

const outHtml = join("/tmp/ol-fonts", "render-wordmarks.html");
mkdirSync("/tmp/ol-fonts", { recursive: true });
writeFileSync(outHtml, html);

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 2,
  viewport: { width: 1400, height: 2400 },
});
await page.goto(pathToFileURL(outHtml).href, { waitUntil: "networkidle" });
await page.evaluate(async () => document.fonts.ready);

async function shot(id, file, omitBackground) {
  const el = page.locator(`#${id}`);
  await el.screenshot({ path: join(assets, file), omitBackground, type: "png" });
  console.log("wrote", file);
}

const onlyOg = process.argv.includes("--og-only");
if (!onlyOg) {
  await shot("wordmark", "wordmark.png", true);
  await shot("wordmark-dark", "wordmark-dark.png", true);
  await shot("lockup", "lockup.png", true);
}
await shot("og", "og.png", false);
await shot("og-dark", "og-dark.png", false);
await browser.close();

const copies = [
  join(root, "../../apps/web/public/brand"),
  join(root, "../../apps/docs/public/brand"),
];
const files = onlyOg
  ? ["og.png", "og-dark.png"]
  : ["wordmark.png", "wordmark-dark.png", "lockup.png", "og.png", "og-dark.png"];
for (const dest of copies) {
  for (const file of files) {
    copyFileSync(join(assets, file), join(dest, file));
  }
  for (const stale of ["wordmark.svg", "wordmark-dark.svg"]) {
    rmSync(join(dest, stale), { force: true });
  }
}

console.log("copied to web/docs public/brand");
console.log("font bytes", readFileSync(fontPath).length);
