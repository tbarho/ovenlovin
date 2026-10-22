import { NextRequest } from "next/server";
import { VERSION } from "@ovenlovin/core";
import { missingApiResponse } from "@/lib/api/missing-route";
import { jsonResponse } from "@/lib/api/response";

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  return jsonResponse({
    name: "OvenLovin REST API",
    version: VERSION,
    openapi: `${origin}/api/v1/openapi.json`,
    docs: `${origin}/docs`,
    mcp: `${origin}/mcp`,
  });
}

export function POST(request: NextRequest) {
  return missingApiResponse(request);
}
