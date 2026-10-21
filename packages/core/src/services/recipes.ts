import { eq, and, isNull, desc, like, sql, asc, inArray } from "drizzle-orm";
import { recipe, recipeIngredient, recipeNutrition, recipeStep, recipeSource } from "@ovenlovin/db";
import type {
  Recipe,
  RecipeContentUpdate,
  RecipeDetails,
  RecipeImportDraft,
  RecipeMethodTag,
  RecipeNutritionFacts,
} from "../schemas/recipes";
import { recipeMethodTagSchema, slugifyTitle } from "../schemas/recipes";
import { backfillParsedIngredient, parseIngredientLine } from "../parsing/ingredient-line";
import { DEFAULT_RECIPE_SERVINGS, scaleIngredientDisplay } from "../scaling/servings";
import type { PaginatedResponse, Pagination } from "../schemas/common";
import { reviewMetadataFromJson } from "../media/import-review";
import { isNearDuplicatePhotoHash } from "../media/photo-hash";
import {
  importDedupeKeys,
  matchFromDedupeKind,
  photoFingerprintFromDraft,
  preferCompletedImport,
  prepareImportDraft,
  sourceUrlFromDraft,
  type ImportDuplicateMatch,
} from "../media/prepare-import-draft";
import { normalizeSourceUrl } from "../media/source-url";
import { BaseService } from "./base";
import { CookbookService } from "./cookbooks";
import { ImportDedupeService } from "./import-dedupe";
import {
  backfillInlineImageList,
  normalizeStoredRecipeImages,
  omitInlineImagePayloads,
  type StoredImagePut,
} from "../media/recipe-images";

export type PersistImportedDraftResult =
  | { outcome: "created"; recipe: RecipeDetails }
  | { outcome: "existing"; recipe: RecipeDetails; match: ImportDuplicateMatch }
  | { outcome: "in_flight"; match: ImportDuplicateMatch };

export class RecipeService extends BaseService {
  async getRecipe(id: string): Promise<Recipe | null> {
    const [result] = await this._db
      .select()
      .from(recipe)
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .limit(1);

    return result ? this.mapRecipe(result) : null;
  }

  async getRecipeBySlug(householdId: string, slug: string): Promise<Recipe | null> {
    const [result] = await this._db
      .select()
      .from(recipe)
      .where(
        and(eq(recipe.householdId, householdId), eq(recipe.slug, slug), isNull(recipe.deletedAt))
      )
      .limit(1);

    return result ? this.mapRecipe(result) : null;
  }

  async listRecipes(
    householdId: string,
    options?: {
      status?: string;
      search?: string;
      cookbookId?: string;
      uncategorized?: boolean;
      ids?: string[];
      pagination?: Pagination;
    }
  ): Promise<PaginatedResponse<Recipe>> {
    const { limit } = this.getPaginationParams(options?.pagination);

    let conditions = [eq(recipe.householdId, householdId), isNull(recipe.deletedAt)];

    if (options?.status) {
      conditions.push(eq(recipe.status, options.status as "draft" | "needs_review" | "published"));
    }

    if (options?.search) {
      conditions.push(like(recipe.title, `%${options.search}%`));
    }

    if (options?.ids && options.ids.length > 0) {
      conditions.push(inArray(recipe.id, options.ids));
    }

    if (options?.cookbookId) {
      const cookbooks = new CookbookService(this._db);
      const recipeIds = await cookbooks.listRecipeIds(options.cookbookId);
      if (recipeIds.length === 0) {
        return this.buildPaginatedResponse([], limit);
      }
      conditions.push(inArray(recipe.id, recipeIds));
    }

    if (options?.uncategorized) {
      const cookbooks = new CookbookService(this._db);
      const recipeIds = await cookbooks.listUncategorizedRecipeIds(householdId);
      if (recipeIds.length === 0) {
        return this.buildPaginatedResponse([], limit);
      }
      conditions.push(inArray(recipe.id, recipeIds));
    }

    const results = await this._db
      .select()
      .from(recipe)
      .where(and(...conditions))
      .orderBy(desc(recipe.createdAt))
      .limit(limit + 1);

    const recipes = results.map((r) => this.mapRecipe(r));

    return this.buildPaginatedResponse(recipes, limit);
  }

  async createRecipe(
    data: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "deletedAt">
  ): Promise<Recipe> {
    const [created] = await this._db
      .insert(recipe)
      .values({
        householdId: data.householdId,
        title: data.title,
        slug: data.slug,
        description: data.description ?? null,
        notes: data.notes ?? null,
        yieldQuantity: data.yieldQuantity ? String(data.yieldQuantity) : null,
        yieldUnit: data.yieldUnit ?? null,
        servings: data.servings ?? null,
        prepTimeMinutes: data.prepTimeMinutes ?? null,
        cookTimeMinutes: data.cookTimeMinutes ?? null,
        totalTimeMinutes: data.totalTimeMinutes ?? null,
        activeTimeMinutes: data.activeTimeMinutes ?? null,
        methodTags: data.methodTags ?? [],
        cuisine: data.cuisine ?? null,
        course: data.course ?? null,
        difficulty: data.difficulty ?? null,
        equipment: data.equipment ?? [],
        images: data.images ?? [],
        status: data.status ?? "draft",
        visibility: data.visibility ?? "private",
        version: data.version ?? 1,
        parentRecipeId: data.parentRecipeId ?? null,
        isFamilyRecipe: data.isFamilyRecipe ?? false,
        familyStory: data.familyStory ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    if (!created) throw new Error("Failed to create recipe");
    return this.mapRecipe(created);
  }

  async updateRecipe(
    id: string,
    data: Partial<Omit<Recipe, "id" | "createdAt" | "updatedAt" | "deletedAt" | "createdBy">>
  ): Promise<Recipe | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }
    if (data.yieldQuantity !== undefined) {
      updateData.yieldQuantity = data.yieldQuantity ? String(data.yieldQuantity) : null;
    }

    const [updated] = await this._db
      .update(recipe)
      .set(updateData)
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .returning();

    return updated ? this.mapRecipe(updated) : null;
  }

  async updateRecipeDetails(id: string, data: RecipeContentUpdate): Promise<RecipeDetails | null> {
    const existing = await this.getRecipe(id);
    if (!existing) return null;

    const nextTotal =
      data.totalTimeMinutes !== undefined
        ? data.totalTimeMinutes
        : data.prepTimeMinutes !== undefined || data.cookTimeMinutes !== undefined
          ? (data.prepTimeMinutes ?? existing.prepTimeMinutes ?? 0) +
            (data.cookTimeMinutes ?? existing.cookTimeMinutes ?? 0)
          : undefined;

    await this.updateRecipe(id, {
      title: data.title,
      description: data.description,
      notes: data.notes,
      servings: data.servings,
      cuisine: data.cuisine,
      prepTimeMinutes: data.prepTimeMinutes,
      cookTimeMinutes: data.cookTimeMinutes,
      totalTimeMinutes: nextTotal,
      images: data.images,
      slug: data.title && data.title !== existing.title ? slugifyTitle(data.title) : undefined,
    });

    if (data.ingredients) {
      const now = new Date();
      await this._db
        .update(recipeIngredient)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(recipeIngredient.recipeId, id), isNull(recipeIngredient.deletedAt)));

      if (data.ingredients.length > 0) {
        await this._db.insert(recipeIngredient).values(
          data.ingredients.map((ingredient, order) => {
            const parsed = parseIngredientLine(ingredient.rawText);
            return {
              recipeId: id,
              order,
              rawText: ingredient.rawText,
              quantityMin:
                ingredient.quantityMin != null
                  ? String(ingredient.quantityMin)
                  : parsed.quantityMin != null
                    ? String(parsed.quantityMin)
                    : null,
              quantityMax:
                ingredient.quantityMax != null
                  ? String(ingredient.quantityMax)
                  : parsed.quantityMax != null
                    ? String(parsed.quantityMax)
                    : null,
              unit: ingredient.unit ?? parsed.unit,
              preparation: ingredient.preparation ?? null,
              isOptional: ingredient.isOptional ?? false,
            };
          })
        );
      }
    }

    if (data.steps) {
      const now = new Date();
      await this._db
        .update(recipeStep)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(recipeStep.recipeId, id), isNull(recipeStep.deletedAt)));

      if (data.steps.length > 0) {
        await this._db.insert(recipeStep).values(
          data.steps.map((step, order) => ({
            recipeId: id,
            order,
            text: step.text,
            timers: step.timers ?? [],
          }))
        );
      }
    }

    if (data.cookbookIds) {
      await new CookbookService(this._db).setRecipeCookbooks(id, data.cookbookIds);
    }

    return this.getRecipeDetails(id);
  }

  async deleteRecipe(id: string): Promise<boolean> {
    const [deleted] = await this._db
      .update(recipe)
      .set({ deletedAt: new Date() })
      .where(and(eq(recipe.id, id), isNull(recipe.deletedAt)))
      .returning();

    return !!deleted;
  }

  async getRecipeIncludingDeleted(id: string): Promise<Recipe | null> {
    const [result] = await this._db.select().from(recipe).where(eq(recipe.id, id)).limit(1);
    return result ? this.mapRecipe(result) : null;
  }

  async restoreRecipe(id: string): Promise<boolean> {
    const [restored] = await this._db
      .update(recipe)
      .set({ deletedAt: null })
      .where(eq(recipe.id, id))
      .returning();

    return !!restored;
  }

  async getRecipeDetails(id: string): Promise<RecipeDetails | null> {
    const found = await this.getRecipe(id);
    if (!found) return null;

    const [ingredients, steps, sources, nutritionRows] = await Promise.all([
      this._db
        .select()
        .from(recipeIngredient)
        .where(and(eq(recipeIngredient.recipeId, id), isNull(recipeIngredient.deletedAt)))
        .orderBy(asc(recipeIngredient.order)),
      this._db
        .select()
        .from(recipeStep)
        .where(and(eq(recipeStep.recipeId, id), isNull(recipeStep.deletedAt)))
        .orderBy(asc(recipeStep.order)),
      this._db
        .select()
        .from(recipeSource)
        .where(and(eq(recipeSource.recipeId, id), isNull(recipeSource.deletedAt)))
        .limit(1),
      this._db
        .select()
        .from(recipeNutrition)
        .where(and(eq(recipeNutrition.recipeId, id), isNull(recipeNutrition.deletedAt)))
        .limit(1),
    ]);

    const cookbooks = await new CookbookService(this._db).listCookbooksForRecipe(id);
    const nutritionRow = nutritionRows[0];
    const nutrition: RecipeNutritionFacts | null = nutritionRow
      ? {
          perServing: nutritionRow.perServing,
          calories: nutritionRow.calories != null ? Number(nutritionRow.calories) : undefined,
          protein: nutritionRow.protein != null ? Number(nutritionRow.protein) : undefined,
          carbohydrates:
            nutritionRow.carbohydrates != null ? Number(nutritionRow.carbohydrates) : undefined,
          fat: nutritionRow.fat != null ? Number(nutritionRow.fat) : undefined,
          fiber: nutritionRow.fiber != null ? Number(nutritionRow.fiber) : undefined,
          sugar: nutritionRow.sugar != null ? Number(nutritionRow.sugar) : undefined,
          sodium: nutritionRow.sodium != null ? Number(nutritionRow.sodium) : undefined,
        }
      : null;

    const review = reviewMetadataFromJson(
      (sources[0]?.rawExtractionJson as Record<string, unknown> | null) ?? null
    );

    return {
      ...found,
      cookbooks,
      nutrition,
      reviewReasons: review.reviewReasons,
      uncertainFields: review.uncertainFields,
      ingredients: ingredients.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        recipeId: row.recipeId,
        groupId: row.groupId ?? null,
        order: row.order,
        rawText: row.rawText,
        ...backfillParsedIngredient({
          rawText: row.rawText,
          quantityMin: row.quantityMin ? Number(row.quantityMin) : null,
          quantityMax: row.quantityMax ? Number(row.quantityMax) : null,
          unit: row.unit ?? null,
        }),
        displayText: scaleIngredientDisplay(
          {
            rawText: row.rawText,
            quantityMin: row.quantityMin ? Number(row.quantityMin) : null,
            quantityMax: row.quantityMax ? Number(row.quantityMax) : null,
            unit: row.unit ?? null,
          },
          found.servings,
          found.servings ?? DEFAULT_RECIPE_SERVINGS
        ),
        originalUnit: row.originalUnit ?? null,
        ingredientId: row.ingredientId ?? null,
        preparation: row.preparation ?? null,
        isOptional: row.isOptional ?? false,
        substitutionNotes: row.substitutionNotes ?? null,
        parseConfidence: row.parseConfidence ? Number(row.parseConfidence) : null,
      })),
      steps: steps.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        recipeId: row.recipeId,
        order: row.order,
        text: row.text,
        timers: (row.timers as Array<{ duration: number; label?: string }>) ?? [],
        referencedIngredientIds: (row.referencedIngredientIds as string[]) ?? [],
        image: row.image ?? null,
      })),
      source: sources[0]
        ? {
            id: sources[0].id,
            createdAt: sources[0].createdAt.toISOString(),
            updatedAt: sources[0].updatedAt.toISOString(),
            deletedAt: sources[0].deletedAt?.toISOString() ?? null,
            recipeId: sources[0].recipeId,
            type: sources[0].type,
            url: sources[0].url ?? null,
            canonicalUrl: sources[0].canonicalUrl ?? null,
            author: sources[0].author ?? null,
            attribution: sources[0].attribution ?? null,
            blobRefs: omitInlineImagePayloads((sources[0].blobRefs as string[]) ?? []),
            importerName: sources[0].importerName ?? null,
            importerVersion: sources[0].importerVersion ?? null,
            modelUsed: sources[0].modelUsed ?? null,
            rawExtractionJson: (sources[0].rawExtractionJson as Record<string, unknown>) ?? null,
            licenseNote: sources[0].licenseNote ?? null,
          }
        : null,
    };
  }

  async createRecipeFromDraft(
    draft: RecipeImportDraft,
    input: { householdId: string; createdBy: string }
  ): Promise<RecipeDetails> {
    draft = prepareImportDraft(draft);
    const methodTags = (draft.methodTags ?? []).filter(
      (tag): tag is RecipeMethodTag => recipeMethodTagSchema.safeParse(tag).success
    );

    let slug = slugifyTitle(draft.title);
    const existing = await this.getRecipeBySlug(input.householdId, slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const created = await this.createRecipe({
      householdId: input.householdId,
      title: draft.title || "Untitled recipe",
      slug,
      description: draft.description ?? null,
      notes: draft.notes ?? null,
      yieldQuantity: draft.yieldQuantity ?? null,
      yieldUnit: draft.yieldUnit ?? null,
      servings: draft.servings ?? null,
      prepTimeMinutes: draft.prepTimeMinutes ?? null,
      cookTimeMinutes: draft.cookTimeMinutes ?? null,
      totalTimeMinutes: draft.totalTimeMinutes ?? null,
      activeTimeMinutes: draft.activeTimeMinutes ?? null,
      methodTags,
      cuisine: draft.cuisine ?? null,
      course: draft.course ?? null,
      difficulty: draft.difficulty ?? null,
      equipment: draft.equipment ?? [],
      images: draft.images ?? [],
      status: draft.needsReview ? "needs_review" : "published",
      visibility: "private",
      version: 1,
      isFamilyRecipe: false,
      createdBy: input.createdBy,
    });

    if (draft.ingredients.length > 0) {
      await this._db.insert(recipeIngredient).values(
        draft.ingredients.map((ingredient, order) => {
          const parsed = parseIngredientLine(ingredient.rawText);
          return {
            recipeId: created.id,
            order,
            rawText: ingredient.rawText,
            quantityMin:
              ingredient.quantity?.min != null
                ? String(ingredient.quantity.min)
                : parsed.quantityMin != null
                  ? String(parsed.quantityMin)
                  : null,
            quantityMax:
              ingredient.quantity?.max != null
                ? String(ingredient.quantity.max)
                : parsed.quantityMax != null
                  ? String(parsed.quantityMax)
                  : null,
            unit: ingredient.unit ?? parsed.unit,
            originalUnit: ingredient.originalUnit ?? null,
            preparation: ingredient.preparation ?? null,
            isOptional: ingredient.isOptional ?? false,
            substitutionNotes: ingredient.substitutionNotes ?? null,
            parseConfidence: ingredient.confidence != null ? String(ingredient.confidence) : null,
          };
        })
      );
    }

    if (draft.steps.length > 0) {
      await this._db.insert(recipeStep).values(
        draft.steps.map((step, order) => ({
          recipeId: created.id,
          order: step.order ?? order,
          text: step.text,
          timers: step.timers ?? [],
        }))
      );
    }

    await this._db.insert(recipeSource).values({
      recipeId: created.id,
      type: draft.source.type,
      url: draft.source.url ?? null,
      canonicalUrl: draft.source.canonicalUrl ?? null,
      author: draft.source.author ?? null,
      attribution: draft.source.attribution ?? null,
      blobRefs: omitInlineImagePayloads([
        ...(draft.source.blobRefs ?? []),
        ...(draft.images ?? []),
      ]),
      importerName: draft.source.importerName,
      importerVersion: draft.source.importerVersion,
      modelUsed: draft.source.modelUsed ?? null,
      rawExtractionJson: draft.source.rawExtractionJson,
      licenseNote: draft.source.licenseNote ?? null,
    });

    if (draft.nutrition) {
      await this._db.insert(recipeNutrition).values({
        recipeId: created.id,
        perServing: draft.nutrition.perServing ?? true,
        calories: draft.nutrition.calories != null ? String(draft.nutrition.calories) : null,
        protein: draft.nutrition.protein != null ? String(draft.nutrition.protein) : null,
        carbohydrates:
          draft.nutrition.carbohydrates != null ? String(draft.nutrition.carbohydrates) : null,
        fat: draft.nutrition.fat != null ? String(draft.nutrition.fat) : null,
        fiber: draft.nutrition.fiber != null ? String(draft.nutrition.fiber) : null,
        sugar: draft.nutrition.sugar != null ? String(draft.nutrition.sugar) : null,
        sodium: draft.nutrition.sodium != null ? String(draft.nutrition.sodium) : null,
        isComputed: false,
        computationMethod: "schema.org NutritionInformation",
        confidence: "1.00",
      });
    }

    const details = await this.getRecipeDetails(created.id);
    if (!details) throw new Error("Failed to load imported recipe");
    return details;
  }

  async findPhotoImportDuplicate(householdId: string, fingerprint: string): Promise<Recipe | null> {
    if (!fingerprint.trim()) return null;
    const [row] = await this._db
      .select({ recipe })
      .from(recipe)
      .innerJoin(recipeSource, eq(recipeSource.recipeId, recipe.id))
      .where(
        and(
          eq(recipe.householdId, householdId),
          isNull(recipe.deletedAt),
          eq(recipeSource.type, "photo"),
          sql`(${recipeSource.rawExtractionJson} ->> 'photoFingerprint') = ${fingerprint}`
        )
      )
      .limit(1);
    return row ? this.mapRecipe(row.recipe) : null;
  }

  async findPhotoNearDuplicate(
    householdId: string,
    perceptualHash: string
  ): Promise<Recipe | null> {
    if (!perceptualHash.trim()) return null;
    const rows = await this._db
      .select({ recipe, raw: recipeSource.rawExtractionJson })
      .from(recipe)
      .innerJoin(recipeSource, eq(recipeSource.recipeId, recipe.id))
      .where(
        and(
          eq(recipe.householdId, householdId),
          isNull(recipe.deletedAt),
          eq(recipeSource.type, "photo")
        )
      );
    for (const row of rows) {
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      const other = raw.photoPerceptualHash;
      if (typeof other === "string" && isNearDuplicatePhotoHash(perceptualHash, other)) {
        return this.mapRecipe(row.recipe);
      }
    }
    return null;
  }

  async findSourceUrlDuplicate(householdId: string, url: string): Promise<Recipe | null> {
    const normalized = normalizeSourceUrl(url);
    if (!normalized) return null;
    const rows = await this._db
      .select({
        recipe,
        url: recipeSource.url,
        canonicalUrl: recipeSource.canonicalUrl,
        raw: recipeSource.rawExtractionJson,
      })
      .from(recipe)
      .innerJoin(recipeSource, eq(recipeSource.recipeId, recipe.id))
      .where(
        and(
          eq(recipe.householdId, householdId),
          isNull(recipe.deletedAt),
          eq(recipeSource.type, "url")
        )
      );
    for (const row of rows) {
      const candidates = [
        typeof (row.raw as Record<string, unknown> | null)?.sourceUrlNormalized === "string"
          ? String((row.raw as Record<string, unknown>).sourceUrlNormalized)
          : "",
        row.canonicalUrl ?? "",
        row.url ?? "",
      ];
      if (candidates.some((candidate) => normalizeSourceUrl(candidate) === normalized)) {
        return this.mapRecipe(row.recipe);
      }
    }
    return null;
  }

  async findImportDuplicate(
    householdId: string,
    draft: RecipeImportDraft
  ): Promise<{ recipe: RecipeDetails; match: ImportDuplicateMatch } | null> {
    const prepared = prepareImportDraft(draft);
    const fingerprint = photoFingerprintFromDraft(prepared);
    if (fingerprint) {
      const exact = await this.findPhotoImportDuplicate(householdId, fingerprint);
      if (exact) {
        const details = await this.getRecipeDetails(exact.id);
        if (details) return { recipe: details, match: "photo" };
      }
    }
    const sourceUrl = sourceUrlFromDraft(prepared);
    if (sourceUrl) {
      const existing = await this.findSourceUrlDuplicate(householdId, sourceUrl);
      if (existing) {
        const details = await this.getRecipeDetails(existing.id);
        if (details) return { recipe: details, match: "source_url" };
      }
    }
    return null;
  }

  async findUrlImportCollision(
    householdId: string,
    url: string,
    idempotencyKey?: string
  ): Promise<{ recipe: RecipeDetails; match: "idempotency" | "source_url" } | null> {
    const trimmed = idempotencyKey?.trim().slice(0, 512);
    if (trimmed) {
      const recipeId = await new ImportDedupeService(this._db).findCompleted(
        householdId,
        "idempotency",
        trimmed
      );
      if (recipeId) {
        const recipe = await this.getRecipeDetails(recipeId);
        if (recipe) return { recipe, match: "idempotency" };
      }
    }
    const existing = await this.findSourceUrlDuplicate(householdId, url);
    if (!existing) return null;
    const recipe = await this.getRecipeDetails(existing.id);
    return recipe ? { recipe, match: "source_url" } : null;
  }

  async persistImportedDraft(
    draft: RecipeImportDraft,
    input: { householdId: string; createdBy: string; idempotencyKey?: string }
  ): Promise<PersistImportedDraftResult> {
    const prepared = prepareImportDraft(draft);
    const dedupe = new ImportDedupeService(this._db);
    const idempotency = importDedupeKeys(prepared, input.idempotencyKey).find(
      (key) => key.kind === "idempotency"
    );
    let replay: RecipeDetails | null = null;
    if (idempotency) {
      const recipeId = await dedupe.findCompleted(
        input.householdId,
        "idempotency",
        idempotency.key
      );
      if (recipeId) replay = await this.getRecipeDetails(recipeId);
    }
    const existing = preferCompletedImport({
      idempotency: replay,
      duplicate: replay ? null : await this.findImportDuplicate(input.householdId, prepared),
    });
    if (existing) return { outcome: "existing", recipe: existing.recipe, match: existing.match };

    const keys = importDedupeKeys(prepared, input.idempotencyKey);
    const claimed: typeof keys = [];
    let created: RecipeDetails | undefined;
    try {
      for (const key of keys) {
        const claim = await dedupe.claim(input.householdId, key.kind, key.key);
        if (claim.status === "completed") {
          const recipeDetails = await this.getRecipeDetails(claim.recipeId);
          if (recipeDetails) {
            return {
              outcome: "existing",
              recipe: recipeDetails,
              match: matchFromDedupeKind(key.kind),
            };
          }
        }
        if (claim.status === "in_flight") {
          return { outcome: "in_flight", match: matchFromDedupeKind(key.kind) };
        }
        claimed.push(key);
      }

      created = await this.createRecipeFromDraft(prepared, input);
      for (const key of claimed) {
        await dedupe.complete(input.householdId, key.kind, key.key, created.id);
      }
      return { outcome: "created", recipe: created };
    } finally {
      if (!created) {
        for (const key of claimed) {
          await dedupe.release(input.householdId, key.kind, key.key);
        }
      }
    }
  }

  /**
   * Copy inline `data:` photos into Blob when a put is configured.
   * No-op without Blob - list/search still rewrite those rows to the image endpoint.
   */
  async backfillInlineImages(put: StoredImagePut | undefined): Promise<{ updated: number }> {
    if (!put) return { updated: 0 };

    const rows = await this._db
      .select({
        id: recipe.id,
        householdId: recipe.householdId,
        images: recipe.images,
      })
      .from(recipe)
      .where(and(isNull(recipe.deletedAt), sql`${recipe.images}::text ilike '%data:image%'`));

    let updated = 0;
    for (const row of rows) {
      const current = normalizeStoredRecipeImages(row.images);
      const result = await backfillInlineImageList(
        current,
        put,
        `recipes/${row.householdId}/backfill/${row.id}`
      );
      if (!result.changed) continue;
      await this._db
        .update(recipe)
        .set({ images: result.images, updatedAt: new Date() })
        .where(eq(recipe.id, row.id));
      updated += 1;
    }

    const sources = await this._db
      .select({
        id: recipeSource.id,
        recipeId: recipeSource.recipeId,
        blobRefs: recipeSource.blobRefs,
      })
      .from(recipeSource)
      .where(
        and(
          isNull(recipeSource.deletedAt),
          sql`${recipeSource.blobRefs}::text ilike '%data:image%'`
        )
      );

    for (const row of sources) {
      const next = omitInlineImagePayloads((row.blobRefs as string[]) ?? []);
      const current = (row.blobRefs as string[]) ?? [];
      if (
        next.length === current.length &&
        next.every((value, index) => value === current[index])
      ) {
        continue;
      }
      await this._db
        .update(recipeSource)
        .set({ blobRefs: next, updatedAt: new Date() })
        .where(eq(recipeSource.id, row.id));
    }

    return { updated };
  }

  async countRecipesByHousehold(householdId: string): Promise<number> {
    const [result] = await this._db
      .select({ count: sql<number>`count(*)` })
      .from(recipe)
      .where(and(eq(recipe.householdId, householdId), isNull(recipe.deletedAt)));

    return result?.count ?? 0;
  }

  private mapRecipe(row: typeof recipe.$inferSelect): Recipe {
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      createdBy: row.createdBy,
      householdId: row.householdId,
      title: row.title,
      slug: row.slug,
      description: row.description ?? null,
      notes: row.notes ?? null,
      yieldQuantity: row.yieldQuantity ? Number(row.yieldQuantity) : null,
      yieldUnit: row.yieldUnit ?? null,
      servings: row.servings ?? null,
      prepTimeMinutes: row.prepTimeMinutes ?? null,
      cookTimeMinutes: row.cookTimeMinutes ?? null,
      totalTimeMinutes: row.totalTimeMinutes ?? null,
      activeTimeMinutes: row.activeTimeMinutes ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      methodTags: (row.methodTags as any) ?? [],
      cuisine: row.cuisine ?? null,
      course: row.course ?? null,
      difficulty: row.difficulty ?? null,
      equipment: (row.equipment as string[]) ?? [],
      images: normalizeStoredRecipeImages(row.images),
      status: row.status,
      visibility: row.visibility,
      version: row.version,
      parentRecipeId: row.parentRecipeId ?? null,
      isFamilyRecipe: row.isFamilyRecipe ?? false,
      familyStory: row.familyStory ?? null,
    };
  }
}
