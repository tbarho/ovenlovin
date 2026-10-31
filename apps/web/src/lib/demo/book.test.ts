import { describe, expect, it } from "vitest";
import { demoBookImages } from "./book";

const DEMO = { OVENLOVIN_DEMO_MODE: "1" };

describe("demoBookImages", () => {
  it("drops the demo plate art so the demo book is set in type", () => {
    expect(demoBookImages(["/demo-kitchen/pesto-pasta.svg"], DEMO)).toEqual([]);
  });

  it("keeps real photos in the demo", () => {
    expect(demoBookImages(["https://x.public.blob.vercel-storage.com/a.jpg"], DEMO)).toEqual([
      "https://x.public.blob.vercel-storage.com/a.jpg",
    ]);
  });

  it("changes nothing outside the demo", () => {
    expect(demoBookImages(["/demo-kitchen/pesto-pasta.svg"], {})).toEqual([
      "/demo-kitchen/pesto-pasta.svg",
    ]);
  });
});
