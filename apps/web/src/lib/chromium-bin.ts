import { existsSync } from "node:fs";
import path from "node:path";

/** Real (non-symlinked) copy of @sparticuz/chromium/bin, filled at prebuild. */
export const CHROMIUM_BIN_DIRNAME = ".chromium-bin";
export const CHROMIUM_BIN_INCLUDE = `./${CHROMIUM_BIN_DIRNAME}/**`;
export const CHROMIUM_BIN_MARKER = "chromium.br";

export function findChromiumBinDir(cwd = process.cwd()) {
  const candidates = [
    path.join(cwd, CHROMIUM_BIN_DIRNAME),
    path.join(cwd, "apps/web", CHROMIUM_BIN_DIRNAME),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, CHROMIUM_BIN_MARKER)));
}
