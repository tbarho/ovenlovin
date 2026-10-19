import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { createdResponse } from "@/lib/api/response";
import { getRequestContext, requireWritableHousehold, requireUserId } from "@/lib/api/middleware";
import { importCapturedPage, parseCapturedPage } from "@/lib/import-page";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    return {
      url: form.get("url"),
      html: form.get("html"),
      jsonLd: form.get("jsonLd"),
    };
  }
  return request.json();
}

function wantsRedirect(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/x-www-form-urlencoded") &&
    !accept.includes("application/json")
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const householdId = requireWritableHousehold(context);
    const createdBy = context.userId || context.clientId || requireUserId(context);

    const captured = parseCapturedPage(await readBody(request));
    const recipe = await importCapturedPage(captured, householdId, createdBy);

    if (wantsRedirect(request)) {
      return NextResponse.redirect(new URL(`/recipes/${recipe.id}`, request.url), 303);
    }

    return createdResponse(recipe, `/api/v1/recipes/${recipe.id}`);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
