import { NextRequest } from "next/server";
import { missingApiResponse } from "@/lib/api/missing-route";

export function GET(request: NextRequest) {
  return missingApiResponse(request);
}

export function POST(request: NextRequest) {
  return missingApiResponse(request);
}
