import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
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
const result = spawnSync(node, [eve, "eval", ...(args.length > 0 ? args : ["import"])], {
  cwd,
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
