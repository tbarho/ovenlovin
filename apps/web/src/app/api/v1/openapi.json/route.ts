import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { generateOpenApiDocument } from "@/lib/api/openapi";

export async function GET(request: NextRequest) {
  try {
    const document = generateOpenApiDocument();
    return jsonResponse(document);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
