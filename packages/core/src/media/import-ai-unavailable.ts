export const IMPORT_AI_UNAVAILABLE_CODE = "import_ai_unavailable";

export const IMPORT_AI_UNAVAILABLE_MESSAGE =
  "Recipe reading is busy right now. Try again in a minute.";

const UNAVAILABLE_STATUSES = new Set([429, 503, 529]);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "";
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const raw = (error as { statusCode?: unknown; status?: unknown }).statusCode;
  if (typeof raw === "number") return raw;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

/** AI Gateway / model down, overloaded, or rate-limited. Not a recipe-site 503. */
export function isImportAiUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = errorName(error);
  if (name === "AI_RetryError") return true;
  if (name.startsWith("AI_") && UNAVAILABLE_STATUSES.has(errorStatus(error) ?? -1)) return true;
  const nested = error as { lastError?: unknown; cause?: unknown; errors?: unknown[] };
  if (nested.lastError && isImportAiUnavailable(nested.lastError)) return true;
  if (nested.cause && nested.cause !== error && isImportAiUnavailable(nested.cause)) return true;
  return Array.isArray(nested.errors) && nested.errors.some(isImportAiUnavailable);
}
