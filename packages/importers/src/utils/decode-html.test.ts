import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./decode-html";

describe("decodeHtmlEntities", () => {
  it("decodes a Serious Eats style apostrophe in a title", () => {
    expect(decodeHtmlEntities("The Food Lab&#39;s Chocolate Chip Cookies")).toBe(
      "The Food Lab's Chocolate Chip Cookies"
    );
  });

  it("decodes hex, named, and double-encoded entities", () => {
    expect(decodeHtmlEntities("salt &amp; pepper")).toBe("salt & pepper");
    expect(decodeHtmlEntities("it&#x27;s done")).toBe("it's done");
    expect(decodeHtmlEntities("1 cup &quot;00&quot; flour")).toBe('1 cup "00" flour');
    expect(decodeHtmlEntities("Lab&amp;#39;s")).toBe("Lab's");
  });

  it("leaves plain text alone", () => {
    expect(decodeHtmlEntities("Beef Stroganoff")).toBe("Beef Stroganoff");
    expect(decodeHtmlEntities("")).toBe("");
  });
});
