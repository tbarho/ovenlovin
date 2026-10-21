import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function major(version) {
  return Number(String(version).replace(/^v/, "").split(".")[0]);
}

function findNode24() {
  if (major(process.versions.node) >= 24) return process.execPath;
  const versions = join(homedir(), ".nvm/versions/node");
  if (!existsSync(versions)) return undefined;
  return readdirSync(versions)
    .filter((name) => major(name) >= 24)
    .sort()
    .map((name) => join(versions, name, "bin/node"))
    .find((bin) => existsSync(bin));
}

const node = findNode24();
if (!node) {
  console.error(
    "eve eval needs Node.js 24+. OvenLovin still runs on Node 20/22. Install Node 24 (nvm install 24) and rerun."
  );
  process.exit(1);
}

const eveRoot = dirname(createRequire(import.meta.url).resolve("eve/package.json"));
const eve = join(eveRoot, "bin/eve.js");
const args = process.argv.slice(2);
const cwd = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(cwd, "package.json");
const originalPkg = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(originalPkg);
// shortcut: eve's project finder only reads dependencies.eve, not devDependencies.
if (!pkg.dependencies?.eve && pkg.devDependencies?.eve) {
  pkg.dependencies = { ...pkg.dependencies, eve: pkg.devDependencies.eve };
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
let result;
try {
  result = spawnSync(node, [eve, "eval", "--strict", ...(args.length > 0 ? args : ["import"])], {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
} finally {
  writeFileSync(pkgPath, originalPkg);
}
process.exit(result?.status ?? 1);
