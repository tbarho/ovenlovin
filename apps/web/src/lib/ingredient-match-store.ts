import { createHash } from "node:crypto";
import {
  evictIngredientMatches,
  ingredientMatchRefs,
  missingIngredientMatches,
  primeIngredientMatches,
} from "@ovenlovin/allergens";
import { onRecipeIngredientsRemoved } from "@ovenlovin/core/recipe-events";
import { getCache, waitUntil } from "@vercel/functions";

type EnvLike = Record<string, string | undefined>;
type SharedCache = ReturnType<typeof getCache>;

const TTL_SECONDS = 7 * 24 * 60 * 60;
/** Recomputing everything costs ~125ms, so a slower read is worse than a miss. */
const READ_TIMEOUT_MS = 150;

/**
 * The shared level behind the in-memory LRU, on deployed Vercel only. Local dev
 * and tests get null and stay memory-only. Entries outlive a deploy, so the
 * namespace is per deployment: a matcher fix can never read an older "no allergen".
 */
export function sharedMatchCache(env: EnvLike = process.env): SharedCache | null {
  const deployed = env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
  if (!deployed || !env.VERCEL_DEPLOYMENT_ID) return null;
  return getCache({ namespace: `allergen-matches-${env.VERCEL_DEPLOYMENT_ID}` });
}

function recipeTag(recipeId: string): string {
  return `recipe:${recipeId}`;
}

function linesKey(lines: string[]): string {
  return createHash("sha256")
    .update([...new Set(lines)].sort().join("\0"))
    .digest("hex");
}

async function readEntry(cache: SharedCache, key: string): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      cache.get(key),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), READ_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error("Allergen match cache read failed", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function inBackground(work: Promise<unknown>) {
  waitUntil(work.catch((error) => console.error("Allergen match cache write failed", error)));
}

/**
 * Call before a synchronous allergen check. One read per recipe the memory
 * cache cannot answer (the shared cache has no batch read), so the check itself
 * stays in memory. A failed read only means the lines get computed.
 */
export async function warmIngredientMatches(
  recipes: Array<{ recipeId: string; lines: string[] }>
): Promise<void> {
  const cache = sharedMatchCache();
  if (!cache) return;
  await Promise.all(
    recipes.map(async ({ recipeId, lines }) => {
      if (missingIngredientMatches(lines).length === 0) return;
      const key = linesKey(lines);
      primeIngredientMatches(await readEntry(cache, key));
      if (missingIngredientMatches(lines).length === 0) return;
      const refs = Object.fromEntries(lines.map((line) => [line, ingredientMatchRefs(line)]));
      inBackground(
        cache.set(key, refs, {
          ttl: TTL_SECONDS,
          tags: [recipeTag(recipeId)],
          name: "allergen-matches",
        })
      );
    })
  );
}

/** Called once per server from instrumentation, so every route is covered. */
export function registerIngredientMatchEviction() {
  onRecipeIngredientsRemoved((recipeId, lines) => {
    evictIngredientMatches(lines);
    const cache = sharedMatchCache();
    if (cache) inBackground(cache.expireTag(recipeTag(recipeId)));
  });
}
