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
      type: this.type,
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
    super(400, "https://your-app.vercel.app/problems/bad-request", "Bad Request", detail, extensions);
  }
}

export class ValidationError extends ApiError {
  constructor(detail: string, errors: unknown) {
    super(400, "https://your-app.vercel.app/problems/validation-error", "Validation Error", detail, {
      errors,
    });
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

export function handleApiError(error: unknown, instance?: string): NextResponse {
  if (error instanceof ApiError) {
    return error.toResponse(instance);
  }

  if (error instanceof ZodError) {
    return ValidationError.fromZodError(error).toResponse(instance);
  }

  console.error("Unhandled API error:", error);

  return new InternalServerError("An unexpected error occurred").toResponse(instance);
}
