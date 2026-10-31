import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { BOOK_LIMITS } from "@ovenlovin/core/jobs";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/api/errors";
import { getRequestContext, requireWritableHousehold } from "@/lib/api/middleware";
import { BOOK_CONTENT_TYPE } from "@/lib/book-import";
import { bookBlobAccess } from "@/lib/books-blob";
import { isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled } from "@/lib/jobs";

/**
 * Mints a short-lived client token so the browser sends the PDF straight to
 * Blob. The file never passes through a function, so the body cap never applies.
 * With the private books store configured, the token is minted for that store.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isBooksEnabled()) throw new NotFoundError("Route");
    if (isDemoModeEnabled()) {
      throw new ForbiddenError("Book uploads are turned off in the public demo.");
    }
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const body = (await request.json()) as HandleUploadBody;

    const { token } = bookBlobAccess();
    const result = await handleUpload({
      body,
      request,
      ...(token ? { token } : {}),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`books/${householdId}/`)) {
          throw new BadRequestError("That upload path is not allowed");
        }
        return {
          allowedContentTypes: [BOOK_CONTENT_TYPE],
          maximumSizeInBytes: BOOK_LIMITS.maxBytes,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
