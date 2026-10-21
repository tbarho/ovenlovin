import { NextRequest } from "next/server";
import { VERSION } from "@ovenlovin/core";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    return jsonResponse({
      status: "ok" as const,
      version: VERSION,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
