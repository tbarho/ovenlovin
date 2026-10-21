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

export const BLOCKED_IMPORT_COPY = "That site would not let us read its recipe.";
export const NOT_A_RECIPE_COPY = "This is not a recipe page.";
export const PAGE_GONE_COPY = "That page is gone.";
export const UNSUPPORTED_SITE_COPY =
  "We can't import from this site. Paste the text or add a photo.";

export function isBlockedImportError(message: string | null | undefined): boolean {
  if (!message) return false;
  return /blocked the importer/i.test(message) || message === BLOCKED_IMPORT_COPY;
}

export function displayImportFailure(message: string): string {
  if (isBlockedImportError(message)) return BLOCKED_IMPORT_COPY;
  if (message === "No recipe found on this page.") return NOT_A_RECIPE_COPY;
  return message;
}

export function importGuessedNotice(title: string, servings: number | null): string {
  const yieldText =
    servings && servings > 0 ? `${servings} servings (guessed)` : "servings unknown";
  return `Imported ${title} · ${yieldText}`;
}
