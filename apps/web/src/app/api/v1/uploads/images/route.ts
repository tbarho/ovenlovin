import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { copyRemoteImages } from "@ovenlovin/core";
import { BadRequestError, ForbiddenError, handleApiError } from "@/lib/api/errors";
import { createdResponse } from "@/lib/api/response";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { createVercelImagePut } from "@/lib/blob-store";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function POST(request: NextRequest) {
  try {
    if (isDemoModeEnabled()) {
      throw new ForbiddenError("Image uploads are turned off in the public demo.");
    }
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { url?: string };
      if (!body.url) throw new BadRequestError("Provide an image url");
      const [stored] = await copyRemoteImages(
        [body.url],
        createVercelImagePut(),
        `recipes/${householdId}/uploads`
      );
      if (!stored) throw new BadRequestError("Could not store that image");
      return createdResponse({ url: stored });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new BadRequestError("Provide an image file");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new BadRequestError("Use a JPEG, PNG, WebP, GIF, or AVIF image");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new BadRequestError("Images must be 8MB or smaller");
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new BadRequestError("Vercel Blob is not configured on this instance");
    }

    const extension = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
    const stored = await put(
      `recipes/${householdId}/uploads/${file.name || `image.${extension}`}`,
      file,
      {
        access: "public",
        contentType: file.type,
        addRandomSuffix: true,
      }
    );

    return createdResponse({ url: stored.url });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
