import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { jsonResponse } from "@/lib/api/response";
import { z, registry } from "@/lib/api/openapi";

const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
    version: z.string(),
    timestamp: z.string().datetime(),
  })
  .openapi("HealthResponse");

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["health"],
  summary: "Health check",
  description: "Returns API health status and version",
  security: [],
  responses: {
    200: {
      description: "API is healthy",
      content: {
        "application/json": {
          schema: healthResponseSchema,
        },
      },
    },
  },
});

export async function GET(request: NextRequest) {
  try {
    const response = {
      status: "ok" as const,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(response);
  } catch (error) {
    return handleApiError(error, request.url);
  }
}
