import { readFileSync } from "node:fs";
import path from "node:path";

const ENTRY = /^## (\d{4}-\d{2}-\d{2})(?: \[([^\]]+)\])? - (.+)$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const CHANGELOG_PATH = path.join(process.cwd(), "../../CHANGELOG.md");

export function formatChangelogDate(date: string) {
  const [year, month, day]: any[] = date.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function blocks(lines: string[]) {
  return lines
    .join("\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      if (chunk.startsWith("### ")) return { type: "h3", text: chunk.slice(4) };
      if (chunk.startsWith("- ")) {
        return { type: "ul", items: chunk.split("\n").map((line) => line.replace(/^- /, "")) };
      }
      return { type: "p", text: chunk.replace(/\n/g, " ") };
    });
}

/** Dated `## YYYY-MM-DD [version] - Title` blocks from CHANGELOG.md, newest first. */
export function parseChangelog(markdown: string) {
  return markdown
    .split("\n")
    .reduce((entries: any[], line) => {
      const match = line.match(ENTRY);
      if (match) {
        const [, date, version, title] = match;
        return [...entries, { date, version: version ?? null, title, lines: [] }];
      }
      if (line.startsWith("## ") || /^\[[^\]]+\]: /.test(line)) {
        return [...entries, null];
      }
      const current = entries.at(-1);
      if (current) current.lines.push(line);
      return entries;
    }, [])
    .filter(Boolean)
    .map(({ lines, ...entry }) => ({ ...entry, blocks: blocks(lines) }));
}

export function loadChangelog() {
  return parseChangelog(readFileSync(CHANGELOG_PATH, "utf8"));
}
