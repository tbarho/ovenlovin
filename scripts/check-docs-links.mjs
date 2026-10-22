#!/usr/bin/env node
/**
 * Check fumadocs static export links the way GitHub Pages serves them.
 *
 * The old workflow only grepped href="/ovenlovin..." and treated a directory
 * as enough. Relative Next Steps links (./agents from /docs/quickstart/) never
 * matched that prefix, so Link Check stayed green while
 * https://tbarho.github.io/ovenlovin/docs/quickstart/agents 404ed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE_PATH = "/ovenlovin";
const DEFAULT_OUT = fileURLToPath(new URL("../apps/docs/out", import.meta.url));

export function pageUrlFromFile(outRoot, htmlFile) {
  const rel = relative(outRoot, htmlFile).split("\\").join("/");
  if (rel.endsWith("/index.html")) return `${BASE_PATH}/${rel.slice(0, -"index.html".length)}`;
  if (rel.endsWith(".html")) return `${BASE_PATH}/${rel.slice(0, -".html".length)}`;
  return `${BASE_PATH}/${rel}`;
}

export function resolveInternalHref(fromUrl, href) {
  const raw = href.split("#")[0].split("?")[0];
  if (!raw) return null;
  if (/^(https?:|mailto:|javascript:|data:)/i.test(raw)) return null;
  const url = new URL(raw, `https://tbarho.github.io${fromUrl}`);
  return url.pathname;
}

export function expectedFiles(outRoot, pathname) {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    path = pathname;
  }
  if (path === BASE_PATH || path === `${BASE_PATH}/`) {
    return [join(outRoot, "index.html")];
  }
  if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
  if (!path.startsWith("/")) path = `/${path}`;
  const last = path.split("/").pop() ?? "";
  if (last.includes(".")) {
    return [join(outRoot, path.slice(1))];
  }
  const stripped = path.replace(/\/+$/, "");
  return [
    join(outRoot, `${stripped}.html`.slice(1)),
    join(outRoot, stripped.slice(1), "index.html"),
  ];
}

export function isLivePath(outRoot, pathname) {
  return expectedFiles(outRoot, pathname).some(
    (file) => existsSync(file) && statSync(file).isFile()
  );
}

function walkHtml(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkHtml(full, files);
    else if (name.endsWith(".html")) files.push(full);
  }
  return files;
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /\b(?:href|src)=(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = re.exec(html))) hrefs.push(match[1] ?? match[2]);
  return hrefs;
}

export function checkDocsLinks(outRoot) {
  const broken = [];
  const missingBase = [];
  for (const htmlFile of walkHtml(outRoot)) {
    const fromUrl = pageUrlFromFile(outRoot, htmlFile);
    const html = readFileSync(htmlFile, "utf8");
    for (const href of extractHrefs(html)) {
      if (href === "/" || href.startsWith("/?") || href.startsWith("/#")) {
        missingBase.push({ file: relative(outRoot, htmlFile), href });
        continue;
      }
      const resolved = resolveInternalHref(fromUrl, href);
      if (!resolved) continue;
      if (resolved === "/docs" || resolved.startsWith("/docs/")) {
        missingBase.push({ file: relative(outRoot, htmlFile), href });
        continue;
      }
      if (!resolved.startsWith(`${BASE_PATH}/`) && resolved !== BASE_PATH) continue;
      if (!isLivePath(outRoot, resolved)) {
        broken.push({
          file: relative(outRoot, htmlFile),
          href,
          resolved,
        });
      }
    }
  }
  return { broken, missingBase };
}

function main() {
  const outRoot = process.argv[2] ? join(process.cwd(), process.argv[2]) : DEFAULT_OUT;
  if (!existsSync(outRoot)) {
    console.error(`Docs export not found: ${outRoot}`);
    process.exit(1);
  }
  const { broken, missingBase } = checkDocsLinks(outRoot);
  if (missingBase.length > 0) {
    console.error("Links missing the /ovenlovin basePath:");
    for (const row of missingBase) console.error(`  ${row.file}: ${row.href}`);
  }
  if (broken.length > 0) {
    console.error("Broken internal links (GitHub Pages would 404):");
    for (const row of broken) {
      console.error(`  ${row.file}: ${row.href} -> ${row.resolved}`);
    }
  }
  if (broken.length > 0 || missingBase.length > 0) {
    console.error(`Found ${broken.length} broken links, ${missingBase.length} missing basePath`);
    process.exit(1);
  }
  console.log("All internal documentation links resolve to an exported file");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
