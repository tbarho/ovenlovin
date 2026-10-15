export function looksLikeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
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
  return null;
}

export function importGuessedNotice(title: string, servings: number | null): string {
  const yieldText =
    servings && servings > 0 ? `${servings} servings (guessed)` : "servings unknown";
  return `Imported ${title} · ${yieldText}`;
}
