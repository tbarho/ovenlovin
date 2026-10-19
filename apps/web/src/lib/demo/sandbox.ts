import { randomUUID } from "node:crypto";
import { and, eq, isNull, lte } from "drizzle-orm";
import { getDatabase, type DbClient } from "@ovenlovin/db";
import {
  apiKey,
  checkResult,
  collection,
  collectionRecipe,
  cookLog,
  demoSandbox,
  household,
  mealPlan,
  mealPlanEntry,
  membership,
  nutritionGoal,
  person,
  personLabelNote,
  personRule,
  preference,
  importDedupe,
  recipe,
  recipeIngredient,
  recipeIngredientGroup,
  recipeNutrition,
  recipeRating,
  recipeSource,
  recipeStep,
  recipeTag,
  scheduleOverride,
  scheduleTemplate,
  share,
  shoppingList,
  shoppingListItem,
  tag,
  user,
} from "@ovenlovin/db/schema";
import type { RequestContext } from "@/lib/api/middleware";
import { DEMO_COOKIE_NAME, DEMO_TTL_MS, DEMO_TTL_SECONDS } from "./fixture";
import { seedDemoKitchen } from "./seed";

export type DemoSandboxRecord = {
  id: string;
  householdId: string;
  userId: string;
  clerkUserId: string;
  apiKeyPlaintext: string;
  expiresAt: Date;
};

export function demoCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: DEMO_TTL_SECONDS,
  };
}

export function isSandboxExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function isDemoCookieName(name: string): boolean {
  return name === DEMO_COOKIE_NAME;
}

async function loadSandbox(db: DbClient, id: string): Promise<DemoSandboxRecord | null> {
  const [row] = await db
    .select({
      id: demoSandbox.id,
      householdId: demoSandbox.householdId,
      userId: demoSandbox.userId,
      apiKeyPlaintext: demoSandbox.apiKeyPlaintext,
      expiresAt: demoSandbox.expiresAt,
      clerkUserId: user.clerkUserId,
      deletedAt: demoSandbox.deletedAt,
    })
    .from(demoSandbox)
    .innerJoin(user, eq(user.id, demoSandbox.userId))
    .where(eq(demoSandbox.id, id))
    .limit(1);

  if (!row || row.deletedAt) return null;
  if (isSandboxExpired(row.expiresAt)) return null;
  return {
    id: row.id,
    householdId: row.householdId,
    userId: row.userId,
    clerkUserId: row.clerkUserId,
    apiKeyPlaintext: row.apiKeyPlaintext,
    expiresAt: row.expiresAt,
  };
}

export async function findDemoSandboxById(
  id: string,
  db: DbClient = getDatabase()
): Promise<DemoSandboxRecord | null> {
  return loadSandbox(db, id);
}

export async function getOrCreateDemoSandbox(
  cookieId: string | undefined,
  db: DbClient = getDatabase()
): Promise<DemoSandboxRecord> {
  if (cookieId) {
    const existing = await findDemoSandboxById(cookieId, db);
    if (existing) return existing;
  }

  const id = randomUUID();
  const seeded = await seedDemoKitchen(db, {
    clerkUserId: `user_demo_${id}`,
    householdSlug: `demo-${id}`,
    email: `demo-${id}@demo.ovenlovin.local`,
  });

  const expiresAt = new Date(Date.now() + DEMO_TTL_MS);
  await db.insert(demoSandbox).values({
    id,
    householdId: seeded.householdId,
    userId: seeded.userId,
    apiKeyId: seeded.apiKeyId,
    apiKeyPlaintext: seeded.apiKeyPlaintext,
    expiresAt,
  });

  return {
    id,
    householdId: seeded.householdId,
    userId: seeded.userId,
    clerkUserId: `user_demo_${id}`,
    apiKeyPlaintext: seeded.apiKeyPlaintext,
    expiresAt,
  };
}

export function sandboxToSession(sandbox: DemoSandboxRecord): RequestContext {
  return {
    userId: sandbox.userId,
    clerkUserId: sandbox.clerkUserId,
    householdId: sandbox.householdId,
    membershipRole: "owner",
  };
}

export async function findDemoSandboxByHousehold(
  householdId: string,
  db: DbClient = getDatabase()
): Promise<DemoSandboxRecord | null> {
  const [row] = await db
    .select({
      id: demoSandbox.id,
      householdId: demoSandbox.householdId,
      userId: demoSandbox.userId,
      apiKeyPlaintext: demoSandbox.apiKeyPlaintext,
      expiresAt: demoSandbox.expiresAt,
      clerkUserId: user.clerkUserId,
      deletedAt: demoSandbox.deletedAt,
    })
    .from(demoSandbox)
    .innerJoin(user, eq(user.id, demoSandbox.userId))
    .where(and(eq(demoSandbox.householdId, householdId), isNull(demoSandbox.deletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    householdId: row.householdId,
    userId: row.userId,
    clerkUserId: row.clerkUserId,
    apiKeyPlaintext: row.apiKeyPlaintext,
    expiresAt: row.expiresAt,
  };
}

export async function resetDemoSandbox(
  cookieId: string | undefined,
  db: DbClient = getDatabase()
): Promise<DemoSandboxRecord> {
  return db.transaction(async (tx) => {
    // Drizzle's transaction handle is query-compatible but not typed as DbClient
    // ($client is missing). Cast so wipe/seed stay on the same connection.
    const session = tx as unknown as DbClient;
    const next = await getOrCreateDemoSandbox(undefined, session);
    if (cookieId) {
      const existing = await findDemoSandboxById(cookieId, session);
      if (existing && existing.id !== next.id) {
        await wipeSandboxHousehold(session, {
          id: existing.id,
          householdId: existing.householdId,
          userId: existing.userId,
        });
      }
    }
    return next;
  });
}

export async function wipeExpiredDemoSandboxes(
  db: DbClient = getDatabase(),
  now = new Date()
): Promise<{ wiped: number }> {
  const expired = await db
    .select({
      id: demoSandbox.id,
      householdId: demoSandbox.householdId,
      userId: demoSandbox.userId,
    })
    .from(demoSandbox)
    .where(and(isNull(demoSandbox.deletedAt), lte(demoSandbox.expiresAt, now)));

  for (const row of expired) {
    await wipeSandboxHousehold(db, row);
  }
  return { wiped: expired.length };
}

/** Child tables wiped before recipes so a failed reset cannot leave empty cards. */
export const DEMO_SANDBOX_RECIPE_CHILD_TABLES = [
  "recipe_ingredient",
  "recipe_ingredient_group",
  "recipe_step",
  "recipe_source",
  "recipe_nutrition",
  "recipe_tag",
  "recipe_rating",
  "cook_log",
] as const;

/** import_dedupe FKs are ON DELETE no action - wipe these before recipes and the household. */
export const DEMO_SANDBOX_IMPORT_TABLES = ["import_dedupe"] as const;

async function wipeSandboxHousehold(
  db: DbClient,
  row: { id: string; householdId: string; userId: string }
): Promise<void> {
  const householdId = row.householdId;

  const lists = await db
    .select({ id: shoppingList.id })
    .from(shoppingList)
    .where(eq(shoppingList.householdId, householdId));
  for (const list of lists) {
    await db.delete(shoppingListItem).where(eq(shoppingListItem.listId, list.id));
  }
  await db.delete(shoppingList).where(eq(shoppingList.householdId, householdId));

  const plans = await db
    .select({ id: mealPlan.id })
    .from(mealPlan)
    .where(eq(mealPlan.householdId, householdId));
  for (const plan of plans) {
    await db.delete(checkResult).where(eq(checkResult.mealPlanId, plan.id));
    await db.delete(mealPlanEntry).where(eq(mealPlanEntry.mealPlanId, plan.id));
  }
  await db.delete(mealPlan).where(eq(mealPlan.householdId, householdId));

  const collections = await db
    .select({ id: collection.id })
    .from(collection)
    .where(eq(collection.householdId, householdId));
  for (const book of collections) {
    await db.delete(collectionRecipe).where(eq(collectionRecipe.collectionId, book.id));
  }
  await db.delete(collection).where(eq(collection.householdId, householdId));

  await db.delete(importDedupe).where(eq(importDedupe.householdId, householdId));

  const recipes = await db
    .select({ id: recipe.id })
    .from(recipe)
    .where(eq(recipe.householdId, householdId));
  for (const item of recipes) {
    await db.delete(recipeIngredient).where(eq(recipeIngredient.recipeId, item.id));
    await db.delete(recipeIngredientGroup).where(eq(recipeIngredientGroup.recipeId, item.id));
    await db.delete(recipeStep).where(eq(recipeStep.recipeId, item.id));
    await db.delete(recipeSource).where(eq(recipeSource.recipeId, item.id));
    await db.delete(recipeNutrition).where(eq(recipeNutrition.recipeId, item.id));
    await db.delete(recipeTag).where(eq(recipeTag.recipeId, item.id));
    await db.delete(recipeRating).where(eq(recipeRating.recipeId, item.id));
    await db.delete(cookLog).where(eq(cookLog.recipeId, item.id));
  }
  await db.delete(recipe).where(eq(recipe.householdId, householdId));
  await db.delete(tag).where(eq(tag.householdId, householdId));

  const people = await db
    .select({ id: person.id })
    .from(person)
    .where(eq(person.householdId, householdId));
  for (const item of people) {
    await db.delete(personRule).where(eq(personRule.personId, item.id));
    await db.delete(preference).where(eq(preference.personId, item.id));
    await db.delete(personLabelNote).where(eq(personLabelNote.personId, item.id));
    await db.delete(nutritionGoal).where(eq(nutritionGoal.personId, item.id));
  }
  await db.delete(person).where(eq(person.householdId, householdId));

  await db.delete(scheduleOverride).where(eq(scheduleOverride.householdId, householdId));
  await db.delete(scheduleTemplate).where(eq(scheduleTemplate.householdId, householdId));
  await db.delete(share).where(eq(share.granteeHouseholdId, householdId));

  await db.delete(demoSandbox).where(eq(demoSandbox.id, row.id));
  await db.delete(apiKey).where(eq(apiKey.householdId, householdId));
  await db.delete(membership).where(eq(membership.householdId, householdId));
  await db.delete(household).where(eq(household.id, householdId));
  await db.delete(user).where(eq(user.id, row.userId));
}
