import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { ApiKeyManager } from "./ApiKeyManager";

const activeKey = {
  id: "key_1",
  name: "Grok key",
  keyPrefix: "rkapi_abcd",
  createdAt: "2026-10-19T17:00:00.000Z",
  lastUsedAt: null,
  revokedAt: null,
};

const createdKey = {
  ...activeKey,
  plaintext: "rkapi_secretplain",
};

const revokedKey = {
  id: "key_2",
  name: "Old key",
  keyPrefix: "rkapi_old1",
  createdAt: "2026-09-01T12:00:00.000Z",
  lastUsedAt: "2026-09-02T12:00:00.000Z",
  revokedAt: "2026-09-03T12:00:00.000Z",
};

describe("ApiKeyManager", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
  });

  it("creates a key from the Field + Input and shows the secret once", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") return createdKey;
      return { items: init?.method === "POST" ? [activeKey] : [] };
    });

    render(<ApiKeyManager onCreated={onCreated} />);
    await waitFor(() => {
      expect(
        screen.getByText("No API keys yet. Create one for Grok, Claude, or ChatGPT.")
      ).toBeVisible();
    });

    const name = screen.getByLabelText("Key Name");
    expect(name).toHaveAttribute("data-slot", "input");
    expect(name).toHaveAttribute("maxLength", "255");
    expect(name).toHaveValue("Agent key");
    expect(screen.getByText("Key Name").closest("[data-slot='field']")).toHaveClass("ds-field");
    const create = screen.getByRole("button", { name: "Create API Key" });
    expect(create).toHaveAttribute("data-slot", "button");
    expect(create).toHaveAttribute("data-variant", "default");

    await user.click(create);
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Agent key" }),
      });
    });
    expect(onCreated).toHaveBeenCalledWith("rkapi_secretplain");
    expect(screen.getByText("Copy this secret now. It will not be shown again.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reveal" })).toBeVisible();
  });

  it("shows a Hint error when creating a key fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "POST") {
        throw new Error("Could not generate an API key");
      }
      return { items: [] };
    });

    render(<ApiKeyManager />);
    await waitFor(() => {
      expect(
        screen.getByText("No API keys yet. Create one for Grok, Claude, or ChatGPT.")
      ).toBeVisible();
    });

    await user.click(screen.getByRole("button", { name: "Create API Key" }));
    const error = await screen.findByText("Could not generate an API key");
    expect(error).toHaveAttribute("data-slot", "hint");
    expect(error).toHaveClass("ds-hint--error");
    expect(
      screen.queryByText("Copy this secret now. It will not be shown again.")
    ).not.toBeInTheDocument();
  });

  it("shows Badge status and revokes through window.confirm", async () => {
    const user = userEvent.setup();
    let items: Array<typeof activeKey | typeof revokedKey> = [activeKey, revokedKey];
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.mocked(api).mockImplementation(async (_path, init) => {
      if (init?.method === "DELETE") {
        items = [revokedKey];
        return activeKey;
      }
      return { items };
    });

    render(<ApiKeyManager />);
    const table = await screen.findByRole("table");
    const grokRow = within(table).getByText("Grok key").closest("tr");
    const oldRow = within(table).getByText("Old key").closest("tr");
    expect(grokRow).not.toBeNull();
    expect(oldRow).not.toBeNull();

    const active = within(grokRow!).getByText("Active").closest("[data-slot='badge']");
    expect(active).toHaveAttribute("data-variant", "ok");
    const revoked = within(oldRow!).getByText("Revoked").closest("[data-slot='badge']");
    expect(revoked).toHaveAttribute("data-variant", "neutral");
    expect(within(oldRow!).queryByRole("button", { name: "Revoke" })).toBeNull();

    const revoke = within(grokRow!).getByRole("button", { name: "Revoke" });
    expect(revoke).toHaveAttribute("data-slot", "button");
    expect(revoke).toHaveAttribute("data-variant", "tertiary");

    await user.click(revoke);
    expect(confirmSpy).toHaveBeenCalledWith("Revoke this key? Agents using it will stop working.");
    await waitFor(() => {
      expect(api).toHaveBeenCalledWith("/api/v1/api-keys/key_1", { method: "DELETE" });
    });
    expect(screen.queryByText("Grok key")).toBeNull();
    expect(screen.getByText("Old key")).toBeVisible();
  });
});
