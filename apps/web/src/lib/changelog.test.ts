import { describe, expect, it } from "vitest";
import { formatChangelogDate, loadChangelog, parseChangelog } from "./changelog";

describe("parseChangelog", () => {
  it("keeps dated entries and skips Unreleased and link refs", () => {
    const entries = parseChangelog(
      [
        "# Changelog",
        "## [Unreleased]",
        "Nothing yet.",
        "## 2026-10-14 [0.1.0] - First kitchen",
        "Lead.",
        "",
        "### People",
        "",
        "- One",
        "- Two",
        "[0.1.0]: https://example.test",
      ].join("\n")
    );
    expect(entries).toEqual([
      {
        date: "2026-10-14",
        version: "0.1.0",
        title: "First kitchen",
        blocks: [
          { type: "p", text: "Lead." },
          { type: "h3", text: "People" },
          { type: "ul", items: ["One", "Two"] },
        ],
      },
    ]);
  });

  it("formats dates like Oct 27, 2026", () => {
    expect(formatChangelogDate("2026-10-07")).toBe("Oct 7, 2026");
  });

  it("reads the repo CHANGELOG.md newest first", () => {
    const dates = loadChangelog().map((entry) => entry.date);
    expect(dates.length).toBeGreaterThan(0);
    expect(dates).toContain("2026-10-14");
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
