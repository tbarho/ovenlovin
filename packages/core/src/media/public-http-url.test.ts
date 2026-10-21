import { describe, expect, it, vi } from "vitest";
import { lookup } from "dns/promises";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import {
  NOT_A_PUBLIC_URL_CODE,
  NOT_A_PUBLIC_URL_MESSAGE,
  NotAPublicUrlError,
  assertPublicHttpUrl,
  fetchPublicHttp,
} from "./public-http-url";
import { classifyImportFailure } from "./import-ai-unavailable";

const I1_AND_I2 = [
  { name: "I-1 10.0.0.1", url: "http://10.0.0.1/" },
  { name: "I-1 192.168.1.1", url: "http://192.168.1.1/" },
  { name: "I-1 example.com:22", url: "http://example.com:22" },
  { name: "I-1 localhost", url: "http://localhost" },
  { name: "I-1 127.0.0.1", url: "http://127.0.0.1" },
  { name: "I-1 decimal IP", url: "http://2130706433/" },
  { name: "I-1 hex IP", url: "http://0x7f000001/" },
  { name: "I-1 octal IP", url: "http://017700000001/" },
  { name: "I-1 [::1]", url: "http://[::1]" },
  { name: "I-1 nip.io loopback", url: "http://127.0.0.1.nip.io/", dns: "127.0.0.1" },
  { name: "I-2 nip.io loopback", url: "http://127.0.0.1.nip.io/", dns: "127.0.0.1" },
  { name: "I-2 nip.io metadata", url: "http://169.254.169.254.nip.io/", dns: "169.254.169.254" },
] as const;

describe("public http url guard", () => {
  it.each(I1_AND_I2)("refuses $name without connecting", async ({ url, dns }) => {
    if (dns) {
      vi.mocked(lookup).mockResolvedValueOnce([{ address: dns, family: 4 }] as never);
    }
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(assertPublicHttpUrl(url)).rejects.toBeInstanceOf(NotAPublicUrlError);
    if (dns) {
      vi.mocked(lookup).mockResolvedValueOnce([{ address: dns, family: 4 }] as never);
    }
    await expect(fetchPublicHttp(url)).rejects.toBeInstanceOf(NotAPublicUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(classifyImportFailure(new NotAPublicUrlError())).toEqual({
      code: NOT_A_PUBLIC_URL_CODE,
      message: NOT_A_PUBLIC_URL_MESSAGE,
    });
    vi.unstubAllGlobals();
  });

  it("refuses a redirect onto a private address without connecting there", async () => {
    const fetchMock = vi.fn(async (requested: string) => {
      if (String(requested).includes("httpbin.org")) {
        return {
          ok: false,
          status: 302,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === "location" ? "http://127.0.0.1/secret" : null,
          },
        } as unknown as Response;
      }
      return { ok: true, status: 200 } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchPublicHttp("https://httpbin.org/redirect-to?url=http://127.0.0.1/")
    ).rejects.toBeInstanceOf(NotAPublicUrlError);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://httpbin.org/redirect-to?url=http://127.0.0.1/",
    ]);
    vi.unstubAllGlobals();
  });

  it("fetches a public URL after DNS says it is public", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://example.com/recipe",
      text: async () => "<html></html>",
    }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await fetchPublicHttp("https://example.com/recipe");
    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
    vi.unstubAllGlobals();
  });
});
