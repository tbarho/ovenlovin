import { describe, expect, it, vi } from "vitest";
import { readContentsPhotos } from "../importers/contents-photo";

vi.mock("@ai-sdk/gateway", () => ({ gateway: (id: string) => id }));

const photo = "data:image/jpeg;base64,AAAA";

describe("readContentsPhotos", () => {
  it("returns lines per photo, in order, with the photos on the vision model", async () => {
    const generate = vi.fn(async () => ({
      object: { pages: [{ lines: ["Contents", "Short ribs 112"] }, { lines: ["Fig tart 150"] }] },
    })) as any;
    const pages = await readContentsPhotos([photo, photo], {
      generate,
      visionModelId: "vision-model",
    });
    expect(pages).toEqual([
      { page: 1, lines: ["Contents", "Short ribs 112"] },
      { page: 2, lines: ["Fig tart 150"] },
    ]);
    const call = generate.mock.calls[0][0];
    expect(call.model).toBe("vision-model");
    expect(call.messages[0].content.filter((part: any) => part.type === "image")).toHaveLength(2);
  });

  it("gives a photo the model skipped no lines", async () => {
    const generate = vi.fn(async () => ({ object: { pages: [{ lines: ["Toast 4"] }] } })) as any;
    const pages = await readContentsPhotos([photo, photo], { generate, visionModelId: "v" });
    expect(pages[1]).toEqual({ page: 2, lines: [] });
  });
});
