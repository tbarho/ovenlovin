import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readDocsFile(relativeFromDocs: string): string {
  return readFileSync(path.resolve(__dirname, "../../../docs", relativeFromDocs), "utf8");
}

describe("Fumadocs landing and quickstart copyable examples", () => {
  it("sends Authorization: ApiKey and POSTs meal-plan check", () => {
    const landing = readDocsFile("src/app/(home)/examples.ts");
    const quickstart = readDocsFile("src/content/docs/quickstart.mdx");

    for (const source of [landing, quickstart]) {
      expect(source).toContain("Authorization");
      expect(source).toContain("ApiKey YOUR_OVENLOVIN_API_KEY");
      expect(source).toContain("/api/v1/");
      expect(source).toMatch(/method:\s*"POST"|-X POST/);
      expect(source).toContain("/meal-plans/");
      expect(source).toContain("/check");
      expect(source).not.toContain('"apiKey"');
      expect(source).not.toMatch(/fetch\(`\/api\/v1\/meal-plans\/\$\{id\}\/check`\)/);
      expect(source).not.toMatch(/fetch\("\/api\/v1\/recipes"/);
    }

    expect(landing).toContain('method: "POST"');
    expect(landing).toContain("ApiKey YOUR_OVENLOVIN_API_KEY");
    expect(quickstart).toContain("-X POST");
  });
});
