import { put } from "@vercel/blob";
import type { StoredImagePut } from "@ovenlovin/core";

export function createVercelImagePut(): StoredImagePut | undefined {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return undefined;

  return async ({ pathname, body, contentType }) => {
    try {
      const stored = await put(pathname, body, {
        access: "public",
        contentType,
        addRandomSuffix: true,
      });
      return stored.url;
    } catch {
      return null;
    }
  };
}
