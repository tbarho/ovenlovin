import type { ImporterConfig, RecipeDraft } from "../types/importer";
import { runPhotoImport } from "../photo-pipeline";
import { createPasteImporter } from "./paste";

const IMPORTER_VERSION = "0.1.0";

export type PdfSpanInput = {
  title: string;
  book: { title: string; author?: string };
  pageStart: number;
  pageEnd: number;
  printedPage?: number | null;
  /** Merged text layer for the span. Set for text pages. */
  text?: string;
  /** Page scans as image data URLs. Set when the span has no text layer. */
  images?: string[];
};

export type PdfSpanRoute = "text" | "vision";

export const pdfSpanRoute = (input: PdfSpanInput): PdfSpanRoute =>
  input.images?.length ? "vision" : "text";

const context = (input: PdfSpanInput) =>
  [
    `This is the recipe "${input.title}" from the cookbook "${input.book.title}".`,
    "The headnote (the intro paragraph between the title and the ingredients) is the description: keep it word for word.",
    "Extract only this recipe. Ignore any other recipe that starts on the same page.",
    input.text && input.images?.length
      ? `Text from the pages that have a text layer:\n${input.text}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

/**
 * One recipe from a cookbook PDF. Text-layer spans go through the paste
 * importer's text model; scanned spans go through the photo vision path on
 * the page scans. Either way the draft comes back as a pdf source with the
 * book and page range on it.
 */
export async function runPdfSpanImport(
  input: PdfSpanInput,
  config: ImporterConfig = {}
): Promise<{ route: PdfSpanRoute; draft: RecipeDraft }> {
  const route = pdfSpanRoute(input);
  const draft =
    route === "vision"
      ? (
          await runPhotoImport(
            { images: input.images!.map((blob) => ({ blob })), context: context(input) },
            config
          )
        ).draft
      : await textDraft(input, config);

  const page = input.printedPage ?? input.pageStart;
  return {
    route,
    draft: {
      ...draft,
      title: draft.title || input.title,
      source: {
        ...draft.source,
        type: "pdf",
        url: undefined,
        author: input.book.author,
        attribution: `${input.book.title}, p. ${page}`,
        bookTitle: input.book.title,
        pageStart: input.pageStart,
        pageEnd: input.pageEnd,
        blobRefs: [],
        importerName: "pdf-importer",
        importerVersion: IMPORTER_VERSION,
        rawExtractionJson: { ...draft.source.rawExtractionJson, route },
        licenseNote: "Cookbook/printed recipe - personal use only",
      },
    },
  };
}

async function textDraft(input: PdfSpanInput, config: ImporterConfig) {
  const importer = createPasteImporter(config);
  return importer.toDraft(
    await importer.extract({ text: input.text ?? "", context: context(input) })
  );
}
