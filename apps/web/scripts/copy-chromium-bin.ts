#!/usr/bin/env tsx
import { cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { CHROMIUM_BIN_DIRNAME } from "../src/lib/chromium-bin";

const appRoot = path.join(__dirname, "..");

export function chromiumBinDest(root = appRoot) {
  return path.join(root, CHROMIUM_BIN_DIRNAME);
}

/** Copies brotli binaries as real files so NFT never packages a pnpm symlink. */
export function copyChromiumBin(root = appRoot) {
  const require = createRequire(__filename);
  const entry = require.resolve("@sparticuz/chromium", { paths: [root] });
  const pkg = realpathSync(path.join(path.dirname(entry), ".."));
  const source = realpathSync(path.join(pkg, "bin"));
  const dest = chromiumBinDest(root);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(source, dest, { recursive: true, dereference: true });
  return dest;
}

const invoked = /copy-chromium-bin\.(ts|js)$/.test(process.argv[1] ?? "");
if (invoked) {
  const dest = copyChromiumBin();
  console.log(`Copied Chromium bin to ${dest}`);
}
