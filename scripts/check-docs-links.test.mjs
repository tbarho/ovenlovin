import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkDocsLinks, isLivePath, resolveInternalHref } from "./check-docs-links.mjs";

describe("check-docs-links", () => {
  it("catches today's Quickstart Next Steps 404 (./agents from /docs/quickstart/)", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-links-"));
    mkdirSync(join(root, "docs", "quickstart"), { recursive: true });
    mkdirSync(join(root, "docs", "agents"), { recursive: true });
    writeFileSync(
      join(root, "docs", "quickstart", "index.html"),
      `<a href="./agents/">Connect Your Agent</a>`
    );
    writeFileSync(join(root, "docs", "agents", "index.html"), "<p>agents</p>");

    const from = "/ovenlovin/docs/quickstart/";
    assert.equal(resolveInternalHref(from, "./agents/"), "/ovenlovin/docs/quickstart/agents/");
    assert.equal(isLivePath(root, "/ovenlovin/docs/quickstart/agents/"), false);
    assert.equal(isLivePath(root, "/ovenlovin/docs/agents/"), true);

    const { broken } = checkDocsLinks(root);
    assert.ok(broken.some((row) => row.resolved === "/ovenlovin/docs/quickstart/agents/"));
  });

  it("accepts a same-directory page that actually exists", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-links-ok-"));
    mkdirSync(join(root, "docs", "quickstart"), { recursive: true });
    mkdirSync(join(root, "docs", "agents"), { recursive: true });
    writeFileSync(
      join(root, "docs", "quickstart", "index.html"),
      `<a href="/ovenlovin/docs/agents/">Connect Your Agent</a>`
    );
    writeFileSync(join(root, "docs", "agents", "index.html"), "<p>agents</p>");

    const { broken } = checkDocsLinks(root);
    assert.deepEqual(broken, []);
  });

  it("catches src=/ missing the /ovenlovin basePath", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-links-src-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    writeFileSync(join(root, "docs", "index.html"), `<img src="/">`);

    const { missingBase } = checkDocsLinks(root);
    assert.ok(missingBase.some((row) => row.href === "/"));
  });

  it("resolves percent-encoded src paths to the on-disk file", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-links-enc-"));
    mkdirSync(join(root, "docs"), { recursive: true });
    mkdirSync(join(root, "_next", "static", "chunks", "app", "docs", "[[...slug]]"), {
      recursive: true,
    });
    writeFileSync(
      join(root, "docs", "index.html"),
      `<script src="/ovenlovin/_next/static/chunks/app/docs/%5B%5B...slug%5D%5D/page.js"></script>`
    );
    writeFileSync(
      join(root, "_next", "static", "chunks", "app", "docs", "[[...slug]]", "page.js"),
      ""
    );

    const { broken } = checkDocsLinks(root);
    assert.deepEqual(broken, []);
  });

  it("catches a single-quoted relative href", () => {
    const root = mkdtempSync(join(tmpdir(), "docs-links-sq-"));
    mkdirSync(join(root, "docs", "quickstart"), { recursive: true });
    mkdirSync(join(root, "docs", "agents"), { recursive: true });
    writeFileSync(
      join(root, "docs", "quickstart", "index.html"),
      `<a href='./agents/'>Connect Your Agent</a>`
    );
    writeFileSync(join(root, "docs", "agents", "index.html"), "<p>agents</p>");

    const { broken } = checkDocsLinks(root);
    assert.ok(broken.some((row) => row.resolved === "/ovenlovin/docs/quickstart/agents/"));
  });
});
