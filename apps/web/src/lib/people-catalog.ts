import {
  findCatalogEntry,
  searchCatalog,
  type CatalogEntry,
  type CatalogGroup,
} from "@ovenlovin/allergens";

const ICON_ALIASES: Record<string, string> = {
  mushrooms: "mushroom",
  onions: "onion",
  olives: "olive",
  gluten: "wheat",
  dairy_free: "milk",
};

export function iconIdForTarget(target: string): string {
  return ICON_ALIASES[target] ?? target;
}

export function catalogGroupForKind(kind: string): CatalogGroup {
  if (kind === "diet") return "diet";
  if (kind === "allergen") return "allergen";
  return "ingredient";
}

export function searchPeopleCatalog(query: string, limit = 24): CatalogEntry[] {
  const q = query.trim();
  if (!q) {
    return [
      ...searchCatalog("", { intent: "allergy", limit: 12 }),
      ...searchCatalog("", { intent: "diet", limit: 8 }),
    ].slice(0, limit);
  }

  const merged = [
    ...searchCatalog(q, { intent: "allergy", limit: 12 }),
    ...searchCatalog(q, { intent: "diet", limit: 8 }),
    ...searchCatalog(q, { intent: "dislike", limit: 8 }),
  ];
  const seen = new Set<string>();
  const unique: CatalogEntry[] = [];
  for (const entry of merged) {
    const key = `${entry.group}:${entry.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  const exact = unique.some(
    (entry) =>
      entry.code === slugTarget(q) || entry.name.toLowerCase() === q.toLowerCase()
  );
  if (!exact) {
    unique.push(customIngredientEntry(q));
  }
  return unique.slice(0, limit);
}

export function entryForRule(target: string, kind: string): CatalogEntry | undefined {
  const group = catalogGroupForKind(kind);
  return (
    findCatalogEntry(target, group) ??
    findCatalogEntry(target) ??
    customIngredientEntry(target)
  );
}

export function customIngredientEntry(raw: string): CatalogEntry {
  const name = raw.trim();
  return {
    code: slugTarget(name),
    name,
    phraseName: name.toLowerCase(),
    group: "ingredient",
    aliases: [],
  };
}

function slugTarget(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || "custom";
}

