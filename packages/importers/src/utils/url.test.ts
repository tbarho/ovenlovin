import { describe, it, expect } from "vitest";
import { parseDuration, extractAuthor, extractImages } from "./url";

describe("parseDuration", () => {
  it("should parse hours and minutes", () => {
    expect(parseDuration("PT1H30M")).toBe(90);
    expect(parseDuration("PT2H")).toBe(120);
    expect(parseDuration("PT45M")).toBe(45);
  });

  it("should handle missing hours or minutes", () => {
    expect(parseDuration("PT15M")).toBe(15);
    expect(parseDuration("PT3H")).toBe(180);
  });

  it("should return undefined for invalid durations", () => {
    expect(parseDuration("")).toBeUndefined();
    expect(parseDuration("invalid")).toBeUndefined();
  });
});

describe("extractAuthor", () => {
  it("should extract author from string", () => {
    expect(extractAuthor({ author: "John Doe" })).toBe("John Doe");
  });

  it("should extract author from object", () => {
    expect(extractAuthor({ author: { name: "Jane Smith" } })).toBe("Jane Smith");
  });

  it("should extract author from array", () => {
    expect(extractAuthor({ author: ["First Author"] })).toBe("First Author");
    expect(extractAuthor({ author: [{ name: "First Author" }] })).toBe("First Author");
  });

  it("should return undefined for missing author", () => {
    expect(extractAuthor({})).toBeUndefined();
  });
});

describe("extractImages", () => {
  it("should extract image from string", () => {
    expect(extractImages({ image: "https://example.com/image.jpg" })).toEqual([
      "https://example.com/image.jpg",
    ]);
  });

  it("should extract images from array", () => {
    expect(
      extractImages({
        image: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      })
    ).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });

  it("should extract image from object", () => {
    expect(extractImages({ image: { url: "https://example.com/image.jpg" } })).toEqual([
      "https://example.com/image.jpg",
    ]);
  });

  it("should extract images from array of objects", () => {
    expect(
      extractImages({
        image: [{ url: "https://example.com/1.jpg" }, { url: "https://example.com/2.jpg" }],
      })
    ).toEqual(["https://example.com/1.jpg", "https://example.com/2.jpg"]);
  });

  it("should return empty array for missing image", () => {
    expect(extractImages({})).toEqual([]);
  });
});
