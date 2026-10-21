import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { requiredRestScope } from "@ovenlovin/core";

const V1_ROOT = dirname(fileURLToPath(import.meta.url));
const EXPORT = /export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g;

function walkRouteFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkRouteFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function toApiPath(file: string): string {
  const rel = relative(V1_ROOT, file).replace(/\/route\.ts$/, "");
  const segments = rel
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith("[") && segment.endsWith("]")) {
        return `{${segment.slice(1, -1)}}`;
      }
      return segment;
    });
  return `/${segments.join("/")}`;
}

describe("REST_SCOPE_TABLE", () => {
  it("maps every v1 route.ts exported method", () => {
    const mapped: string[] = [];
    for (const file of walkRouteFiles(V1_ROOT)) {
      const rel = relative(V1_ROOT, file);
      if (rel === "route.ts" || rel.includes("[...")) continue;
      const path = toApiPath(file);
      const src = readFileSync(file, "utf8");
      for (const match of src.matchAll(EXPORT)) {
        const method = match[1] ?? "";
        expect(
          requiredRestScope(method, `/api/v1${path === "/" ? "" : path}`),
          `${method} ${path}`
        ).not.toBeUndefined();
        mapped.push(`${method} ${path}`);
      }
    }
    expect(mapped.length).toBeGreaterThan(40);
  });
});
