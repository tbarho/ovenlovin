import { z } from "zod";
import { BadRequestError } from "./errors";

export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError("Request body must be JSON");
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BadRequestError("Request body must be a JSON object");
  }
  return schema.parse(raw);
}
