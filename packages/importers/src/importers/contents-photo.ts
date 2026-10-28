/* eslint-disable no-undef */
import { generateObject } from "ai";
import { z } from "zod";
import { inlinePublicImageBlob } from "@ovenlovin/core";
import { tagImportAiTimeout } from "@ovenlovin/core/import-ai-unavailable";
import type { ImporterConfig } from "../types/importer";
import { generateImportObject, resolveVisionModelId } from "../utils/models";

const schema = z.object({
  pages: z
    .array(z.object({ lines: z.array(z.string()).describe("Printed lines, top to bottom") }))
    .describe("One entry per photo, in the order given"),
});

const PROMPT = `These photos are the contents or index pages of a printed cookbook, in order.
Transcribe each photo as lines, top to bottom, exactly as printed. Do not invent or fix anything.
- Keep each entry on one line with its page number at the end, e.g. "Short ribs 112" or "Short ribs, 112".
- Keep section headings (e.g. "Suppers", "Index") as their own lines.
- Skip running heads, folios, and decorations.
Return one pages entry per photo, even when a photo is unreadable (then return no lines).`;

/** Lines from photos of a paper cookbook's contents or index pages, one entry per photo. */
export async function readContentsPhotos(images: string[], config: ImporterConfig = {}) {
  const inline = await Promise.all(images.map((image) => inlinePublicImageBlob(image)));
  try {
    const result = await generateImportObject(
      config.generate ?? generateObject,
      resolveVisionModelId(config.visionModelId),
      {
        abortSignal: config.abortSignal ?? AbortSignal.timeout(55_000),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              ...inline.map((image) => ({ type: "image" as const, image })),
            ],
          },
        ],
        schema,
      }
    );
    const pages: { lines: string[] }[] = result.object?.pages ?? [];
    return images.map((_, at) => ({ page: at + 1, lines: pages[at]?.lines ?? [] }));
  } catch (error) {
    throw tagImportAiTimeout(error);
  }
}
