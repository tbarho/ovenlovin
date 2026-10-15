#!/usr/bin/env node
/**
 * Fail if a tracked text file contains an em dash (U+2014) or en dash (U+2013).
 * Binary files (null bytes or image/font extensions) are skipped.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const EM = "\u2014";
const EN = "\u2013";
const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
]);

const files = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const hits = [];
for (const file of files) {
  if (SKIP_EXT.has(extname(file).toLowerCase())) continue;
  const buf = readFileSync(file);
  if (buf.includes(0)) continue;
  const text = buf.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.includes(EM) || line.includes(EN)) {
      hits.push(`${file}:${index + 1}`);
    }
  }
}

if (hits.length > 0) {
  console.error(
    "Em dashes (U+2014) and en dashes (U+2013) are not allowed. Use '-' or spaced ' - '."
  );
  for (const hit of hits) {
    console.error(`  ${hit}`);
  }
  process.exit(1);
}

console.log("No em or en dashes in tracked text files.");
