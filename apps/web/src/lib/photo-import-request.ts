import { z } from "zod";
import { assertAllowedRecipeImageUrls } from "@ovenlovin/core";
import { BadRequestError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/read-json";
import {
  collectPhotoImages,
  fileToImageInput,
  PHOTO_IMPORT_MIME_TYPES,
  type PhotoImageInput,
} from "./photo-import";

export type PhotoImportRequest = {
  images: PhotoImageInput[];
  isHandwritten: boolean;
  save: boolean;
  allowDuplicate: boolean;
  cookbookId?: string;
  draft?: unknown;
};

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}

export async function readPhotoImportRequest(request: Request): Promise<PhotoImportRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const images: PhotoImageInput[] = [];
    const files = [...form.getAll("image"), ...form.getAll("images"), ...form.getAll("file")];
    for (const entry of files) {
      if (entry instanceof File && entry.size > 0) {
        if (entry.size > 8 * 1024 * 1024) {
          throw new BadRequestError("Images must be 8MB or smaller");
        }
        if (entry.type && !PHOTO_IMPORT_MIME_TYPES.has(entry.type)) {
          throw new BadRequestError("Use a JPEG, PNG, WebP, GIF, or AVIF image");
        }
        images.push(await fileToImageInput(entry));
      }
    }

    const imageUrl = form.get("imageUrl");
    if (typeof imageUrl === "string" && imageUrl.trim()) {
      images.push({ blob: imageUrl.trim() });
    }

    const draftRaw = form.get("draft");
    let draft: unknown;
    if (typeof draftRaw === "string" && draftRaw.trim()) {
      try {
        draft = JSON.parse(draftRaw) as unknown;
      } catch {
        throw new BadRequestError("That previewed draft is not a recipe");
      }
    }

    assertAllowedRecipeImageUrls(images.map((image) => image.blob));

    if (images.length === 0 && draft == null) {
      throw new BadRequestError("Provide one or more recipe photos (file or imageUrl)");
    }

    const cookbookId = form.get("cookbookId");
    return {
      images,
      isHandwritten: asBoolean(form.get("isHandwritten")),
      save: asBoolean(form.get("save")),
      allowDuplicate: asBoolean(form.get("allowDuplicate")),
      cookbookId:
        typeof cookbookId === "string" && cookbookId.trim() ? cookbookId.trim() : undefined,
      draft,
    };
  }

  const body = await readJsonBody(
    request,
    z.object({
      imageUrl: z.string().max(2048).optional(),
      imageUrls: z.array(z.string().max(2048)).max(20).optional(),
      imageBase64: z
        .string()
        .max(16 * 1024 * 1024)
        .optional(),
      mimeType: z.string().max(100).optional(),
      images: z
        .array(
          z.object({
            url: z.string().max(2048).optional(),
            base64: z
              .string()
              .max(16 * 1024 * 1024)
              .optional(),
            mimeType: z.string().max(100).optional(),
            filename: z.string().max(255).optional(),
          })
        )
        .max(20)
        .optional(),
      isHandwritten: z.boolean().optional(),
      save: z.union([z.boolean(), z.string(), z.number()]).optional(),
      allowDuplicate: z.union([z.boolean(), z.string(), z.number()]).optional(),
      cookbookId: z.string().uuid().optional(),
      draft: z.unknown().optional(),
    })
  );

  const images = collectPhotoImages(body);
  assertAllowedRecipeImageUrls(images.map((image) => image.blob));
  if (images.length === 0 && body.draft == null) {
    throw new BadRequestError(
      "Provide an imageUrl, imageBase64, or images[] (URL or base64) for photo import"
    );
  }

  return {
    images,
    isHandwritten: Boolean(body.isHandwritten),
    save: asBoolean(body.save),
    allowDuplicate: asBoolean(body.allowDuplicate),
    cookbookId: body.cookbookId,
    draft: body.draft,
  };
}
