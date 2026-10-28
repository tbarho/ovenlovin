import { describe, expect, it, vi } from "vitest";
import { runPdfSpanImport } from "../importers/pdf";

vi.mock("@ai-sdk/gateway", () => ({ gateway: (id: string) => id }));

const book = { title: "A Synthetic Kitchen", author: "Author A" };
const recipe = {
  title: "Buttermilk Pancakes",
  description: "Our Sunday stack.",
  servings: 4,
  ingredients: [
    { text: "2 cups flour", quantity: "2", unit: "cups", ingredient: "flour", confidence: "high" },
    {
      text: "1 cup buttermilk",
      quantity: "1",
      unit: "cup",
      ingredient: "buttermilk",
      confidence: "high",
    },
  ],
  steps: [{ text: "Whisk and cook on a hot griddle.", confidence: "high" }],
  ocrQuality: "good",
};

const fake = () => vi.fn(async () => ({ object: recipe })) as any;

describe("runPdfSpanImport", () => {
  it("reads a text span with the text model and files it as a pdf source", async () => {
    const generate = fake();
    const { route, draft } = await runPdfSpanImport(
      {
        title: "Buttermilk Pancakes",
        book,
        pageStart: 5,
        pageEnd: 6,
        printedPage: 2,
        text: "Buttermilk Pancakes\nOur Sunday stack.\n2 cups flour\n1 cup buttermilk",
      },
      { generate, modelId: "text-model", visionModelId: "vision-model" }
    );

    expect(route).toBe("text");
    const call = generate.mock.calls[0][0];
    expect(call.model).toBe("text-model");
    expect(call.prompt).toContain("headnote");
    expect(call.prompt).toContain("1 cup buttermilk");
    expect(draft.description).toBe("Our Sunday stack.");
    expect(draft.ingredients).toHaveLength(2);
    expect(draft.overallConfidence).toBeGreaterThan(0);
    expect(draft.source).toMatchObject({
      type: "pdf",
      author: "Author A",
      bookTitle: "A Synthetic Kitchen",
      attribution: "A Synthetic Kitchen, p. 2",
      pageStart: 5,
      pageEnd: 6,
      importerName: "pdf-importer",
      rawExtractionJson: expect.objectContaining({ route: "text" }),
    });
  });

  it("reads scanned pages with the vision model, page scans in order", async () => {
    const generate = fake();
    const scans = ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"];
    const { route, draft } = await runPdfSpanImport(
      { title: "Fish Stew", book, pageStart: 2, pageEnd: 3, images: scans },
      { generate, modelId: "text-model", visionModelId: "vision-model" }
    );

    expect(route).toBe("vision");
    const call = generate.mock.calls[0][0];
    expect(call.model).toBe("vision-model");
    const content = call.messages[0].content;
    expect(content[0].text).toContain('"Fish Stew"');
    expect(content.slice(1).map((part: any) => part.image)).toEqual(scans);
    expect(draft.source).toMatchObject({
      type: "pdf",
      pageStart: 2,
      pageEnd: 3,
      attribution: "A Synthetic Kitchen, p. 2",
    });
  });
});
