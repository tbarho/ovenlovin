import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("ui primitive tokens", () => {
  const css = readFileSync(path.resolve(__dirname, "./ui.css"), "utf8");

  it("styles button, badge, avatar, and form controls with --ds-* custom properties", () => {
    expect(css).toContain("--ds-color-interactive-primary-bg");
    expect(css).toContain("--ds-color-interactive-secondary-bg");
    expect(css).toContain("--ds-color-interactive-switch-knob");
    expect(css).toContain("--ds-color-status-danger-solid");
    expect(css).toContain("--ds-color-status-warning-solid");
    expect(css).toContain("--ds-color-status-success-bg");
    expect(css).toContain("--ds-color-status-danger-fg");
    expect(css).toContain("--ds-color-border-error");
    expect(css).toContain("--ds-size-control-tiny");
    expect(css).toContain("--ds-size-control-small");
    expect(css).toContain("--ds-size-control-medium");
    expect(css).toContain("--ds-size-control-large");
    expect(css).toContain("--ds-size-icon");
    expect(css).toContain("--ds-size-avatar-16");
    expect(css).toContain("--ds-size-avatar-24");
    expect(css).toContain("--ds-size-avatar-32");
    expect(css).toContain("--ds-size-avatar-48");
    expect(css).toContain("--ds-radius-base");
    expect(css).toContain("--ds-radius-full");
    expect(css).toContain("--ds-type-button-14");
    expect(css).toContain("--ds-type-label-14");
    expect(css).toContain("--ds-type-copy-14");
    expect(css).toContain("--ds-space-24x");
    expect(css).toContain("--ds-duration-micro");
    expect(css).toContain("--ds-focus-ring");
  });

  it("does not invent off-token hex colors", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });
});
