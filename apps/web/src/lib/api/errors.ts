import {
  HouseholdAccessError,
  IMPORT_AI_UNAVAILABLE_CODE,
  IMPORT_AI_UNAVAILABLE_MESSAGE,
  classifyImportFailure,
  INVALID_IMAGE_URL_CODE,
  INVALID_IMAGE_URL_MESSAGE,
  InvalidImageUrlError,
  importAiUnavailableMeta,
  isImportAiUnavailable,
} from "@ovenlovin/core";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ProblemDetail = {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
};

export const PROBLEM_TYPE_PLACEHOLDER_ORIGIN = "https://your-app.vercel.app";

export function originFromInstance(instance?: string): string {
  if (instance) {
    try {
      return new URL(instance).origin;
    } catch {
      // fall through
    }
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  return configured || "http://localhost:3000";
}

export function problemTypeForInstance(type: string, instance?: string): string {
  if (!type.startsWith(`${PROBLEM_TYPE_PLACEHOLDER_ORIGIN}/`)) {
    return type;
  }
  return `${originFromInstance(instance)}${type.slice(PROBLEM_TYPE_PLACEHOLDER_ORIGIN.length)}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public type: string,
    public title: string,
    public detail?: string,
    public extensions?: Record<string, unknown>
  ) {
    super(title);
    this.name = "ApiError";
  }

  toProblemDetail(instance?: string): ProblemDetail {
    return {
      type: problemTypeForInstance(this.type, instance),
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance,
      ...this.extensions,
    };
  }

  toResponse(instance?: string): NextResponse {
    const headers: Record<string, string> = {
      "Content-Type": "application/problem+json",
    };
    const retryAfter = this.extensions?.retryAfter;
    if (typeof retryAfter === "number" && Number.isFinite(retryAfter)) {
      headers["Retry-After"] = String(Math.max(0, Math.ceil(retryAfter)));
    }
    return NextResponse.json(this.toProblemDetail(instance), {
      status: this.status,
      headers,
    });
  }
}

export class BadRequestError extends ApiError {
  constructor(detail?: string, extensions?: Record<string, unknown>) {
    super(
      400,
      "https://your-app.vercel.app/problems/bad-request",
      "Bad Request",
      detail,
      extensions
    );
  }
}

export class ValidationError extends ApiError {
  constructor(detail: string, errors: unknown) {
    super(
      400,
      "https://your-app.vercel.app/problems/validation-error",
      "Validation Error",
      detail,
      {
        errors,
      }
    );
  }

  static fromZodError(error: ZodError): ValidationError {
    const errors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));

    return new ValidationError("Request validation failed", errors);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(detail?: string) {
    super(401, "https://your-app.vercel.app/problems/unauthorized", "Unauthorized", detail);
  }
}

export class ForbiddenError extends ApiError {
  constructor(detail?: string, extensions?: Record<string, unknown>) {
    super(403, "https://your-app.vercel.app/problems/forbidden", "Forbidden", detail, extensions);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const detail = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, "https://your-app.vercel.app/problems/not-found", "Not Found", detail);
  }
}

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Invalid ids (e.g. "x") must 404 as problem+json, not 500 from Postgres uuid parse. */
export function requireResourceId(resource: string, id: string): string {
  if (!RESOURCE_ID.test(id)) {
    throw new NotFoundError(resource, id);
  }
  return id;
}

export class ConflictError extends ApiError {
  constructor(detail: string, extensions?: Record<string, unknown>) {
    super(409, "https://your-app.vercel.app/problems/conflict", "Conflict", detail, extensions);
  }
}

export class InternalServerError extends ApiError {
  constructor(detail?: string) {
    super(
      500,
      "https://your-app.vercel.app/problems/internal-server-error",
      "Internal Server Error",
      detail
    );
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(detail?: string, extensions?: Record<string, unknown>) {
    super(
      503,
      "https://your-app.vercel.app/problems/service-unavailable",
      "Service Unavailable",
      detail,
      extensions
    );
  }

  toResponse(instance?: string): NextResponse {
    const response = super.toResponse(instance);
    response.headers.set("Retry-After", "60");
    return response;
  }
}

export function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function handleApiError(error: unknown, instance?: string): NextResponse {
  if (error instanceof HouseholdAccessError) {
    const status =
      error.code === "forbidden"
        ? 403
        : error.code === "not_found"
          ? 404
          : error.code === "conflict"
            ? 409
            : error.code === "expired"
              ? 410
              : 400;
    const title =
      status === 403
        ? "Forbidden"
        : status === 404
          ? "Not Found"
          : status === 409
            ? "Conflict"
            : status === 410
              ? "Gone"
              : "Bad Request";
    const type =
      status === 403
        ? "forbidden"
        : status === 404
          ? "not-found"
          : status === 409
            ? "conflict"
            : status === 410
              ? "gone"
              : "bad-request";
    return new ApiError(
      status,
      `https://your-app.vercel.app/problems/${type}`,
      title,
      error.message
    ).toResponse(instance);
  }

  if (error instanceof ApiError) {
    return error.toResponse(instance);
  }

  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error).toResponse(instance);
  }

  if (error instanceof SyntaxError) {
    return new BadRequestError("Request body must be JSON").toResponse(instance);
  }

  if (error instanceof InvalidImageUrlError) {
    return new BadRequestError(error.message, { code: error.code }).toResponse(instance);
  }
  if (error instanceof Error && error.message === "blocked image url") {
    return new BadRequestError(INVALID_IMAGE_URL_MESSAGE, {
      code: INVALID_IMAGE_URL_CODE,
    }).toResponse(instance);
  }

  // Demo HTML routes redirect to /api/demo/enter. If that throw leaks into a
  // REST handler, return problem+json 401 instead of a 500.
  if (isNextRedirectError(error)) {
    return new UnauthorizedError("Authentication required").toResponse(instance);
  }

  const importFailure = classifyImportFailure(error);
  if (importFailure) {
    return new BadRequestError(importFailure.message, {
      code: importFailure.code,
    }).toResponse(instance);
  }

  if (isImportAiUnavailable(error)) {
    console.warn("import_ai_unavailable", importAiUnavailableMeta(error));
    return new ServiceUnavailableError(IMPORT_AI_UNAVAILABLE_MESSAGE, {
      code: IMPORT_AI_UNAVAILABLE_CODE,
    }).toResponse(instance);
  }

  console.error("Unhandled API error:", error);

  return new InternalServerError("An unexpected error occurred").toResponse(instance);
}
