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
    return NextResponse.json(this.toProblemDetail(instance), {
      status: this.status,
      headers: {
        "Content-Type": "application/problem+json",
      },
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
  constructor(detail?: string) {
    super(403, "https://your-app.vercel.app/problems/forbidden", "Forbidden", detail);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const detail = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(404, "https://your-app.vercel.app/problems/not-found", "Not Found", detail);
  }
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
  if (error instanceof ApiError) {
    return error.toResponse(instance);
  }

  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error).toResponse(instance);
  }

  // Demo HTML routes redirect to /api/demo/enter. If that throw leaks into a
  // REST handler, return problem+json 401 instead of a 500.
  if (isNextRedirectError(error)) {
    return new UnauthorizedError("Authentication required").toResponse(instance);
  }

  console.error("Unhandled API error:", error);

  return new InternalServerError("An unexpected error occurred").toResponse(instance);
}
