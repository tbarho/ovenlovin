import { afterEach, describe, expect, it, vi } from "vitest";

const { api } = await vi.importActual<typeof import("./browser-api")>("./browser-api");

describe("api keepalive", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults POST and PATCH to keepalive unless overridden", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await api("/x", { method: "POST" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ keepalive: true });

    await api("/x", { method: "PATCH" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ keepalive: true });

    await api("/x");
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ keepalive: false });

    await api("/x", { method: "POST", keepalive: false });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ keepalive: false });
  });
});
