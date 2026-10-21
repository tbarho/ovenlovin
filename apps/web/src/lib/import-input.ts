import {
  IMPORT_BLOCKED_MESSAGE,
  IMPORT_NOT_A_RECIPE_MESSAGE,
  IMPORT_PAGE_GONE_MESSAGE,
  IMPORT_UNSUPPORTED_SITE_MESSAGE,
  classifyImportFailure,
} from "@ovenlovin/core/import-ai-unavailable";

const EXAMPLE_HOSTS = new Set(["example.com", "example.org", "example.net", "example.edu"]);

export function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isExamplePlaceholderUrl(value: string): boolean {
  try {
    const host = new URL(value.trim()).hostname.toLowerCase();
    return EXAMPLE_HOSTS.has(host) || [...EXAMPLE_HOSTS].some((name) => host.endsWith(`.${name}`));
  } catch {
    return false;
  }
}

export function importInputError(source: "url" | "paste", content: string): string | null {
  if (!content.trim()) {
    return source === "paste" ? "Paste a recipe first" : "Enter a web address first";
  }
  if (source === "url" && !looksLikeHttpUrl(content)) {
    return "That doesn't look like a web address";
  }
  if (source === "url" && isExamplePlaceholderUrl(content)) {
    return NOT_A_RECIPE_COPY;
  }
  return null;
}

export const BLOCKED_IMPORT_COPY = IMPORT_BLOCKED_MESSAGE;
export const NOT_A_RECIPE_COPY = IMPORT_NOT_A_RECIPE_MESSAGE;
export const PAGE_GONE_COPY = IMPORT_PAGE_GONE_MESSAGE;
export const UNSUPPORTED_SITE_COPY = IMPORT_UNSUPPORTED_SITE_MESSAGE;

export function isBlockedImportError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /blocked the importer/i.test(message);
}

export function displayImportFailure(message: string): string {
  return classifyImportFailure(new Error(message))?.message ?? message;
}

export function importGuessedNotice(title: string, servings: number | null): string {
  const yieldText =
    servings && servings > 0 ? `${servings} servings (guessed)` : "servings unknown";
  return `Imported ${title} · ${yieldText}`;
}
