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
    return "example.com is a placeholder, not a recipe page. Paste a real recipe URL, or type the recipe instead.";
  }
  return null;
}

export function importGuessedNotice(title: string, servings: number | null): string {
  const yieldText =
    servings && servings > 0 ? `${servings} servings (guessed)` : "servings unknown";
  return `Imported ${title} · ${yieldText}`;
}
