import { NextResponse } from "next/server";
import type { PaginatedResponse } from "@ovenlovin/core";

export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function paginatedResponse<T>(
  data: PaginatedResponse<T>,
  status = 200,
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json(data, { status });
}

export function createdResponse<T>(data: T, location?: string): NextResponse {
  const headers: Record<string, string> = {};
  if (location) {
    headers.Location = location;
  }
  return NextResponse.json(data, {
    status: 201,
    headers,
  });
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
