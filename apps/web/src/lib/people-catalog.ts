import {
  findCatalogEntry,
  searchCatalog,
  type CatalogEntry,
  type CatalogGroup,
  type RuleIntent,
} from "@ovenlovin/allergens";

const ICON_ALIASES: Record<string, string> = {
  mushrooms: "mushroom",
  onions: "onion",
  olives: "olive",
  gluten: "wheat",
  dairy_free: "milk",
  mexican: "spicy",
  italian: "vegetarian",
  chinese: "spicy",
  american: "egg",
  salmon: "fish",
  chicken: "egg",
  pasta: "wheat",
  chocolate: "egg",
  sheet_pan: "vegetarian",
};

export type PeoplePickerMode = "cant_eat" | "doesnt_like" | "loves";

export function iconIdForTarget(target: string): string {
  return ICON_ALIASES[target] ?? target;
}

export function catalogGroupForKind(kind: string): CatalogGroup {
  if (kind === "diet") return "diet";
  if (kind === "allergen") return "allergen";
  return "ingredient";
}

function searchIntentsForMode(mode: PeoplePickerMode): RuleIntent[] {
  if (mode === "doesnt_like") return ["dislike", "allergy", "diet"];
  if (mode === "loves") return ["love", "dislike", "diet"];
  return ["allergy", "diet", "dislike"];
}

export function searchPeopleCatalog(
  query: string,
  options: { mode?: PeoplePickerMode; limit?: number } = {}
): CatalogEntry[] {
  const mode = options.mode ?? "cant_eat";
  const limit = options.limit ?? 24;
  const q = query.trim();
  if (!q) return [];

  const merged = searchIntentsForMode(mode).flatMap((intent) =>
    searchCatalog(q, { intent, limit: 12 })
  );
  const seen = new Set<string>();
  const unique: CatalogEntry[] = [];
  for (const entry of merged) {
    const key = `${entry.group}:${entry.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique.slice(0, limit);
}

export function topCatalogMatch(
  query: string,
  options: { mode?: PeoplePickerMode; selectedTargets?: string[]; limit?: number } = {}
): CatalogEntry | null {
  const tiles = searchPeopleCatalog(query, {
    mode: options.mode,
    limit: options.limit ?? 24,
  });
  return tiles.find((entry) => !options.selectedTargets?.includes(entry.code)) ?? null;
}

export function unknownAllergenWarning(query: string, suggestion: CatalogEntry | null): string {
  const typed = query.trim();
  if (suggestion) {
    return `We can't check '${typed}' against recipes; did you mean ${suggestion.name}?`;
  }
  return `We can't check '${typed}' against recipes. Save it only if you meant this exact food.`;
}

export type FoodAddResolution =
  | { kind: "canonical"; entry: CatalogEntry }
  | { kind: "unknown"; entry: CatalogEntry; suggestion: CatalogEntry | null };

export function resolveFoodAdd(
  query: string,
  options: { mode?: PeoplePickerMode; selectedTargets?: string[] } = {}
): FoodAddResolution | null {
  const q = query.trim();
  if (!q) return null;
  const suggestion = topCatalogMatch(q, options);
  const custom = customCatalogOffer(q);
  if (!custom && suggestion) return { kind: "canonical", entry: suggestion };
  if (custom) return { kind: "unknown", entry: custom, suggestion };
  return null;
}

export function customCatalogOffer(query: string): CatalogEntry | null {
  const q = query.trim();
  if (!q) return null;
  const matches = searchPeopleCatalog(q, { limit: 40 });
  const needle = q.toLowerCase();
  const exact = matches.some(
    (entry) =>
      entry.code === slugTarget(q) ||
      entry.name.toLowerCase() === needle ||
      entry.phraseName.toLowerCase() === needle ||
      entry.aliases.some((alias) => alias.toLowerCase() === needle)
  );
  if (exact) return null;
  return customIngredientEntry(q);
}

export function entryForRule(target: string, kind: string): CatalogEntry | undefined {
  const group = catalogGroupForKind(kind);
  return (
    findCatalogEntry(target, group) ?? findCatalogEntry(target) ?? customIngredientEntry(target)
  );
}

export function customIngredientEntry(raw: string): CatalogEntry {
  const name = raw.trim();
  return {
    code: slugTarget(name) === "custom" ? name.toLowerCase() : slugTarget(name),
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
