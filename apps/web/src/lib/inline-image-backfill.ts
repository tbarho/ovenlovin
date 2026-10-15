import type { RecipeService } from "@ovenlovin/core";
import { createVercelImagePut } from "@/lib/blob-store";

let pending: Promise<{ updated: number }> | null = null;

/** Once per process, copy leftover `data:` photos into Blob when a token is set. */
export function scheduleInlineImageBackfill(service: RecipeService): void {
  const put = createVercelImagePut();
  if (!put || pending) return;
  pending = service.backfillInlineImages(put).catch(() => ({ updated: 0 }));
}
