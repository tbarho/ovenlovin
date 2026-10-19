import { BadRequestError } from "@/lib/api/errors";
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
};

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
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

    if (images.length === 0) {
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
    };
  }

  const body = (await request.json()) as {
    imageUrl?: string;
    imageUrls?: string[];
    imageBase64?: string;
    mimeType?: string;
    images?: Array<{ url?: string; base64?: string; mimeType?: string }>;
    isHandwritten?: boolean;
    save?: boolean;
    allowDuplicate?: boolean;
    cookbookId?: string;
  };

  const images = collectPhotoImages(body);
  if (images.length === 0) {
    throw new BadRequestError(
      "Provide an imageUrl, imageBase64, or images[] (URL or base64) for photo import"
    );
  }

  return {
    images,
    isHandwritten: Boolean(body.isHandwritten),
    save: Boolean(body.save),
    allowDuplicate: Boolean(body.allowDuplicate),
    cookbookId: body.cookbookId,
  };
}
