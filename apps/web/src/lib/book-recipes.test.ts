import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { planRecipeItems, PermanentJobError } from "@ovenlovin/core/jobs";
import { runPdfSpanImport, type PdfSpanInput } from "@ovenlovin/importers";
import { PHOTO_BOOK } from "@/test/book-fixtures";
import { textPdf } from "@/test/pdf-fixture";
import { mapPdf } from "@/lib/book-contents";
import { extractBookRecipe, readSpan } from "@/lib/book-recipes";

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@ai-sdk/gateway", () => ({ gateway: (id: string) => id }));

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const BLOB = `https://store1.public.blob.vercel-storage.com/books/${HOUSEHOLD}/abc.pdf`;
const SHA = "a".repeat(64);
const HERO = "https://store1.public.blob.vercel-storage.com/recipes/hero.png";

let dir = "";
let path = "";

beforeAll(async () => {
  vi.stubEnv("BLOB_STORE_HOST", "store1.public.blob.vercel-storage.com");
  dir = await mkdtemp(join(tmpdir(), "ovenlovin-recipes-"));
  path = join(dir, "book.pdf");
  await writeFile(path, textPdf(PHOTO_BOOK.pages, PHOTO_BOOK.info));
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const queue = () =>
  ({
    get: vi.fn(async () => ({
      id: "job-1",
      householdId: HOUSEHOLD,
      input: { blobUrl: BLOB, sha256: SHA, name: "synthetic.pdf", pages: 6 },
    })),
  }) as any;

/** The model echoes back what a cookbook page would give: title, headnote, lines. */
const generate = vi.fn(async (options: any) => {
  const prompt = options.prompt ?? options.messages[0].content[0].text;
  const title = prompt.match(/recipe "([^"]+)"/)![1];
  return {
    object: {
      title,
      description:
        title === "Buttermilk Pancakes" ? "Our Sunday stack, doubled on birthdays." : undefined,
      servings: 4,
      ingredients: [
        {
          text: "2 cups flour",
          quantity: "2",
          unit: "cups",
          ingredient: "flour",
          confidence: "high",
        },
      ],
      steps: [{ text: "Whisk and cook on a hot griddle.", confidence: "high" }],
      ocrQuality: "good",
    },
  };
}) as any;

async function extractAll(deps: { duplicate?: any } = {}) {
  const map = await mapPdf(path);
  const items = planRecipeItems(
    map,
    map.candidates.map((candidate) => candidate.id),
    6
  );
  const sent: PdfSpanInput[] = [];
  const put = vi.fn(async () => HERO);
  const results = await items.reduce(
    async (memo: Promise<any[]>, payload, at) => [
      ...(await memo),
      await extractBookRecipe(
        queue(),
        { id: `item-${at}`, jobId: "job-1", householdId: HOUSEHOLD, payload } as any,
        {
          read: (_source, start, end, name) => readSpan(path, start, end, name),
          extract: (input) => {
            sent.push(input);
            return runPdfSpanImport(input, {
              generate,
              modelId: "text-model",
              visionModelId: "vision-model",
            });
          },
          put,
          recipes: {
            findImportDuplicate: vi.fn(async () => deps.duplicate ?? null),
            findPhotoNearDuplicate: vi.fn(async () => null),
          } as any,
        }
      ),
    ],
    Promise.resolve([])
  );
  return { items, sent, put, results };
}

describe("extractBookRecipe (golden)", () => {
  it("plans one span per recipe, trimming the section divider", async () => {
    const { items } = await extractAll();
    expect(items.map(({ title, pageStart, pageEnd }) => [title, pageStart, pageEnd])).toEqual([
      ["Buttermilk Pancakes", 2, 3],
      ["Fish Stew", 4, 5],
      ["Tomato Soup", 6, 6],
    ]);
  });

  it("merges a recipe across a page break and sends it to the text model", async () => {
    const { sent, results } = await extractAll();
    expect(sent[0]).toEqual({
      title: "Buttermilk Pancakes",
      book: { title: "A Synthetic Kitchen", author: "Author A" },
      pageStart: 2,
      pageEnd: 3,
      printedPage: 1,
      text: [
        "Buttermilk Pancakes",
        "Our Sunday stack, doubled on birthdays.",
        "Serves 4",
        "2 cups flour",
        "1 cup buttermilk",
        "2 eggs",
        "Whisk and cook on a hot griddle.",
      ].join("\n"),
      images: undefined,
    });
    expect(results[0]).toMatchObject({
      candidateId: "1-buttermilk-pancakes",
      route: "text",
      duplicate: null,
      draft: {
        title: "Buttermilk Pancakes",
        description: "Our Sunday stack, doubled on birthdays.",
        images: [HERO],
        source: {
          type: "pdf",
          author: "Author A",
          bookTitle: "A Synthetic Kitchen",
          attribution: "A Synthetic Kitchen, p. 1",
          pageStart: 2,
          pageEnd: 3,
          blobRefs: [BLOB],
          rawExtractionJson: {
            route: "text",
            candidateId: "1-buttermilk-pancakes",
            photoFingerprint: `pdf:${SHA}:1-buttermilk-pancakes`,
            photoPerceptualHash: expect.stringMatching(/^[0-9a-f]{16}$/),
          },
        },
      },
    });
    expect(results[0]!.draft.overallConfidence).toBeGreaterThan(0);
  });

  it("reads a scanned page with vision, ends before the divider, and keeps the scan out of the hero", async () => {
    const { sent, results, put } = await extractAll();
    expect(sent[1]).toMatchObject({
      title: "Fish Stew",
      pageStart: 4,
      pageEnd: 4,
      text: undefined,
    });
    expect(sent[1]!.images).toHaveLength(1);
    expect(sent[1]!.images![0]).toMatch(/^data:image\/png;base64,/);
    expect(results[1]).toMatchObject({
      route: "vision",
      draft: { images: [], source: { pageEnd: 4 } },
    });
    expect(results[1]!.draft.source.rawExtractionJson.photoPerceptualHash).toBeUndefined();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it("skips ornaments as hero candidates", async () => {
    const { results } = await extractAll();
    expect(results[2]).toMatchObject({ route: "text", draft: { images: [] } });
  });

  it("flags a recipe already in the household", async () => {
    const { results } = await extractAll({
      duplicate: { recipe: { id: "r-1", title: "Buttermilk Pancakes" }, match: "photo" },
    });
    expect(results[0]!.duplicate).toEqual({
      recipeId: "r-1",
      title: "Buttermilk Pancakes",
      match: "photo",
    });
  });

  it("refuses an upload from another household", async () => {
    const bad = {
      get: vi.fn(async () => ({ input: { blobUrl: "https://evil.example/x.pdf" } })),
    } as any;
    await expect(
      extractBookRecipe(bad, { jobId: "job-1", householdId: HOUSEHOLD, payload: {} } as any)
    ).rejects.toBeInstanceOf(PermanentJobError);
  });
});

describe("readSpan over http", () => {
  let server: Server;
  let url = "";

  beforeAll(async () => {
    const bytes = await readFile(path);
    server = createServer((request, response) => {
      const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (!range) {
        response.writeHead(200, { "content-length": bytes.length, "accept-ranges": "bytes" });
        return response.end(bytes);
      }
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : bytes.length - 1;
      response.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${bytes.length}`,
        "content-length": end - start + 1,
        "accept-ranges": "bytes",
      });
      response.end(bytes.subarray(start, end + 1));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(server.address() as any).port}/book.pdf`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("reads the span straight from the blob URL", async () => {
    const read = await readSpan(url, 2, 3);
    expect(read.pages.map((page) => page.page)).toEqual([2, 3]);
    expect(read.hero).toMatchObject({ width: 300, height: 220 });
  });
});
