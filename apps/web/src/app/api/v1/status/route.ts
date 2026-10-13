import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { getConfigStatus } from "@/lib/status";

export async function GET(request: NextRequest) {
  try {
    const status = await getConfigStatus();
    return jsonResponse(status);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
