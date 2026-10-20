export const IMPORT_AI_UNAVAILABLE_CODE = "import_ai_unavailable";

export const IMPORT_AI_UNAVAILABLE_MESSAGE =
  "Recipe reading is busy right now. Try again in a minute.";

const UNAVAILABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

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

export type ImportAiUnavailableMeta = {
  provider?: string;
  model?: string;
  statusCode?: number;
  generationId?: string;
};

function readString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/** Fields for one Vercel log line when recipe reading is down. */
export function importAiUnavailableMeta(error: unknown): ImportAiUnavailableMeta {
  const meta: ImportAiUnavailableMeta = {};
  const seen = new Set<unknown>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const obj = value as Record<string, unknown>;
    if (meta.statusCode == null) {
      const status = errorStatus(value);
      if (status != null) meta.statusCode = status;
    }
    if (meta.model == null) {
      const model = readString(obj, ["modelId", "model"]);
      if (model) meta.model = model;
    }
    if (meta.provider == null) {
      const provider = readString(obj, ["provider", "providerId"]);
      if (provider) meta.provider = provider;
    }
    if (meta.generationId == null) {
      const generationId = readString(obj, ["generationId", "generation_id"]);
      if (generationId) meta.generationId = generationId;
    }
    visit(obj.lastError);
    visit(obj.cause);
    visit(obj.data);
    if (Array.isArray(obj.errors)) {
      for (const nested of obj.errors) visit(nested);
    }
  };
  visit(error);
  return meta;
}

/** Mark a generateObject timeout so only importer AI aborts become import_ai_unavailable. */
export function tagImportAiTimeout(error: unknown): unknown {
  const seen = new Set<unknown>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value instanceof Error && (value.name === "TimeoutError" || value.name === "AbortError")) {
      Object.assign(value, { importAiTimeout: true });
    }
    const nested = value as { lastError?: unknown; cause?: unknown; errors?: unknown[] };
    visit(nested.lastError);
    visit(nested.cause);
    if (Array.isArray(nested.errors)) {
      for (const inner of nested.errors) visit(inner);
    }
  };
  visit(error);
  return error;
}

/** AI Gateway / model down, overloaded, or rate-limited. Not a recipe-site 503. */
export function isImportAiUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { importAiTimeout?: unknown }).importAiTimeout === true) return true;
  const name = errorName(error);
  if (name === "AI_RetryError" || name === "AI_NoObjectGeneratedError") return true;
  if (name.startsWith("AI_") && UNAVAILABLE_STATUSES.has(errorStatus(error) ?? -1)) return true;
  const nested = error as { lastError?: unknown; cause?: unknown; errors?: unknown[] };
  if (nested.lastError && isImportAiUnavailable(nested.lastError)) return true;
  if (nested.cause && nested.cause !== error && isImportAiUnavailable(nested.cause)) return true;
  return Array.isArray(nested.errors) && nested.errors.some(isImportAiUnavailable);
}
