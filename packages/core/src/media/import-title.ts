/** Drop Wikibooks / MediaWiki cookbook namespace from imported titles. */
export function stripCookbookNamespace(title: string): string {
  return title.replace(/^Cookbook:\s*/i, "").trim();
}

export function stripTrailingRecipeWord(title: string): string {
  const stripped = title.replace(/\s+recipe\s*$/i, "").trim();
  return stripped.length > 0 ? stripped : title.trim();
}

export function cleanImportedTitle(title: string): string {
  return stripTrailingRecipeWord(stripCookbookNamespace(title.trim()));
}
