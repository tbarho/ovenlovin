import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";

export function missingApiMessage(pathname: string): string {
  return `${pathname} is not an API route. Use /api/v1/{resource}, or mint a demo key with /api/demo/enter?format=json.`;
}

export function missingApiResponse(request: NextRequest): NextResponse {
  const pathname = request.nextUrl.pathname;
  return new ApiError(
    404,
    "https://your-app.vercel.app/problems/not-found",
    "Not Found",
    missingApiMessage(pathname)
  ).toResponse(request.url);
}
