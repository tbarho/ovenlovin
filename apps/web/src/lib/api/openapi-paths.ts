import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { createMealPlanBodySchema, updateMealPlanBodySchema } from "@ovenlovin/core";
import { z } from "zod";

extendZodWithOpenApi(z);

export function registerApiPaths(registry: OpenAPIRegistry) {
  const recipeTimes = {
    servings: z.number().int().positive().nullable().optional(),
    prepTimeMinutes: z.number().int().nonnegative().nullable().optional(),
    cookTimeMinutes: z.number().int().nonnegative().nullable().optional(),
    totalTimeMinutes: z.number().int().nonnegative().nullable().optional(),
  };

  const recipeSchema = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      title: z.string(),
      slug: z.string(),
      description: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      ...recipeTimes,
      images: z.array(z.string()),
      status: z.enum(["draft", "needs_review", "published"]),
      cuisine: z.string().nullable().optional(),
      course: z.string().nullable().optional(),
      reviewReasons: z.array(z.string()).optional(),
      uncertainFields: z.array(z.string()).optional(),
      remainingImports: z.number().int().nonnegative().optional(),
    })
    .openapi("Recipe");

  const cookbookSchema = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      description: z.string().nullable().optional(),
      sortOrder: z.number().int().nonnegative(),
    })
    .openapi("Cookbook");

  const cookbookCardSchema = cookbookSchema
    .extend({
      recipeCount: z.number().int().nonnegative(),
      previewImages: z.array(z.string()),
    })
    .openapi("CookbookCard");

  const configStatusSchema = z
    .object({
      ready: z.boolean(),
      mode: z.enum(["demo", "product"]),
      commitSha: z
        .string()
        .nullable()
        .describe("VERCEL_GIT_COMMIT_SHA for this deploy, or null when not on Vercel."),
      checks: z.array(
        z.object({
          id: z.enum(["database", "clerk", "aiGateway", "blob"]),
          label: z.string(),
          configured: z.boolean(),
          required: z.boolean(),
          reachable: z.boolean().optional(),
          detail: z.string(),
        })
      ),
    })
    .openapi("ConfigStatus");

  registry.registerPath({
    method: "get",
    path: "/status",
    tags: ["health"],
    summary: "Instance configuration and deploy SHA",
    description:
      "Reports integration readiness and the Vercel git commit SHA (`VERCEL_GIT_COMMIT_SHA`). Unauthenticated.",
    security: [],
    responses: {
      200: {
        description: "Config status",
        content: { "application/json": { schema: configStatusSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/recipes",
    tags: ["recipes"],
    summary: "List recipes",
    description:
      "`images` is a thumbnail URL only. Photo imports never inline `data:` bytes here; fetch `GET /recipes/{id}/image` when Blob is not configured.",
    request: {
      query: z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        cursor: z.string().optional(),
        search: z.string().optional(),
        forAttendees: z
          .string()
          .optional()
          .describe(
            "Comma-separated person IDs. Recipes that hit a block rule for any attendee are omitted from items and listed in hidden with hiddenCount."
          ),
        cookbookId: z.string().uuid().optional(),
        uncategorized: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Recipe page. When forAttendees is set, also returns hiddenCount and hidden.",
        content: {
          "application/json": {
            schema: z.object({
              items: z.array(recipeSchema),
              hiddenCount: z.number().int().nonnegative().optional(),
              hidden: z
                .array(
                  z.object({
                    id: z.string(),
                    title: z.string(),
                    reasons: z.array(
                      z.object({
                        personId: z.string(),
                        personName: z.string(),
                        ingredientName: z.string(),
                        message: z.string(),
                      })
                    ),
                  })
                )
                .optional(),
            }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/recipes",
    tags: ["recipes"],
    summary: "Create a recipe directly (title, ingredients, steps)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              title: z.string(),
              description: z.string().optional(),
              notes: z.string().optional(),
              servings: z.number().int().positive().optional(),
              prepTimeMinutes: z.number().int().nonnegative().optional(),
              cookTimeMinutes: z.number().int().nonnegative().optional(),
              images: z.array(z.string()).optional(),
              ingredients: z.array(z.object({ rawText: z.string() })).optional(),
              steps: z.array(z.object({ text: z.string() })).optional(),
              cookbookId: z.string().uuid().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created recipe",
        content: { "application/json": { schema: recipeSchema } },
      },
    },
  });

  const recipeDetailsSchema = recipeSchema
    .extend({
      displayServings: z
        .number()
        .int()
        .min(1)
        .max(24)
        .describe(
          "Kitchen Default servings, or the `servings` query override. `servings` remains the stored card yield."
        ),
      scaledNote: z.string().nullable().optional(),
      ingredients: z
        .array(
          z.object({
            id: z.string().uuid(),
            rawText: z.string(),
            displayText: z.string().optional(),
            quantityMin: z.number().nullable().optional(),
            unit: z.string().nullable().optional(),
          })
        )
        .optional(),
    })
    .openapi("RecipeDetails");

  registry.registerPath({
    method: "get",
    path: "/recipes/{id}",
    tags: ["recipes"],
    summary: "Get a recipe with ingredients, steps, times, notes, images, and source",
    description:
      "displayServings applies kitchen Default servings (family = max(yield, People count)). Pass ?servings= to override. ingredients.displayText is scaled to displayServings; rawText is the stored import string.",
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({
        servings: z.coerce.number().int().min(1).max(24).optional(),
      }),
    },
    responses: {
      200: {
        description: "Recipe details",
        content: { "application/json": { schema: recipeDetailsSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/recipes/{id}",
    tags: ["recipes"],
    summary: "Update recipe metadata, ingredients, steps, images, or cookbook membership",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              title: z.string().optional(),
              description: z.string().nullable().optional(),
              notes: z.string().nullable().optional(),
              ...recipeTimes,
              images: z.array(z.string()).optional(),
              cookbookIds: z.array(z.string().uuid()).optional(),
              ingredients: z.array(z.object({ rawText: z.string() })).optional(),
              steps: z.array(z.object({ text: z.string() })).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated recipe",
        content: { "application/json": { schema: recipeSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/recipes/{id}/image",
    tags: ["recipes"],
    summary: "Main recipe photo (thumbnail URL from list/search)",
    description:
      "Returns the stored main photo. List and search never inline image bytes: they expose this URL (or a Blob URL) instead of data: URLs. Requires the same household auth as GET /recipes/{id}.",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Image bytes" },
      302: { description: "Redirect to a Blob or remote URL" },
      404: { description: "Recipe or image not found" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/recipes/{id}",
    tags: ["recipes"],
    summary: "Soft-delete a recipe",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  registry.registerPath({
    method: "post",
    path: "/recipes/{id}/restore",
    tags: ["recipes"],
    summary: "Restore a soft-deleted recipe",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: "Restored recipe",
        content: { "application/json": { schema: recipeSchema } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/recipes/import",
    tags: ["recipes"],
    summary: "Import a recipe from a URL or pasted text",
    description:
      "Preview by default (`save` omitted or false). Persist only when `save=true`. Preview responses include `saved:false` and `preview:true`. Send `Idempotency-Key` so a dropped connection can be retried without a second recipe. URL duplicates and in-flight locks return 409 with `recipeId` / `recipeUrl`. Demo responses include `remainingImports`.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              source: z.enum(["url", "paste"]),
              content: z.string(),
              save: z
                .boolean()
                .optional()
                .describe("When true, persist the recipe. Default is preview only."),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Extracted draft for review (save omitted or false), or an idempotent replay",
        content: { "application/json": { schema: recipeSchema } },
      },
      201: {
        description: "Imported recipe when save=true",
        content: { "application/json": { schema: recipeSchema } },
      },
      409: {
        description: "Duplicate or in-flight import. Includes recipeId, title, and recipeUrl.",
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/recipes/import/page",
    tags: ["recipes"],
    summary:
      "Import a recipe from HTML or JSON-LD captured on the user's device (Safari shortcut or browser bookmark)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              url: z.string().url(),
              html: z.string().optional(),
              jsonLd: z.unknown().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Imported recipe",
        content: { "application/json": { schema: recipeSchema } },
      },
    },
  });

  const photoImportPreview = z
    .object({
      title: z.string(),
      notes: z.string().optional(),
      servings: z.number().int().positive().optional(),
      prepTimeMinutes: z.number().int().nonnegative().optional(),
      cookTimeMinutes: z.number().int().nonnegative().optional(),
      totalTimeMinutes: z.number().int().nonnegative().optional(),
      ingredients: z.array(
        z.object({
          rawText: z.string(),
          name: z.string().optional(),
          quantityMin: z.number().nullable().optional(),
          quantityMax: z.number().nullable().optional(),
          unit: z.string().nullable().optional(),
        })
      ),
      steps: z.array(z.object({ text: z.string() })),
      images: z.array(z.string()),
      overallConfidence: z.number(),
      needsReview: z.boolean(),
      reviewReasons: z.array(z.string()),
      uncertainFields: z.array(z.string()),
      allergenClassifications: z.array(
        z.object({
          ingredientText: z.string(),
          allergenCode: z.string(),
          allergenName: z.string(),
          relation: z.string(),
        })
      ),
    })
    .openapi("PhotoImportPreview");

  registry.registerPath({
    method: "post",
    path: "/recipes/import/photo",
    tags: ["recipes"],
    summary:
      "Extract a recipe from one or more photos (review by default). Persist only when save=true, same as POST /recipes/import. Exact SHA matches return 409 with the existing recipeId. Near-duplicate PNG photos (perceptual hash of PNG bytes only) are a warning: preview includes possibleDuplicate {recipeId,title}; save:true without allowDuplicate:true returns 409 with the same field. Send allowDuplicate:true to persist anyway. Send Idempotency-Key on save so retries do not create a second recipe.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              imageUrl: z.string().optional(),
              imageUrls: z.array(z.string()).optional(),
              imageBase64: z.string().optional(),
              mimeType: z.string().optional(),
              images: z
                .array(
                  z.object({
                    url: z.string().optional(),
                    base64: z.string().optional(),
                    mimeType: z.string().optional(),
                  })
                )
                .optional(),
              isHandwritten: z.boolean().optional(),
              save: z.boolean().optional(),
              allowDuplicate: z
                .boolean()
                .optional()
                .describe("When true, persist even if a similar PNG photo already exists."),
              cookbookId: z.string().uuid().optional(),
            }),
          },
          "multipart/form-data": {
            schema: z.object({
              image: z
                .string()
                .optional()
                .describe("Recipe photo file (repeatable as images/file)"),
              imageUrl: z.string().optional(),
              isHandwritten: z.string().optional(),
              save: z.string().optional(),
              allowDuplicate: z.string().optional(),
              cookbookId: z.string().uuid().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Extracted draft for review (save omitted or false)",
        content: { "application/json": { schema: photoImportPreview } },
      },
      201: {
        description: "Saved recipe when save=true",
        content: {
          "application/json": {
            schema: photoImportPreview.extend({ recipe: recipeSchema }),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/cookbooks",
    tags: ["cookbooks"],
    summary: "List cookbooks",
    responses: {
      200: {
        description: "Cookbook page",
        content: {
          "application/json": { schema: z.object({ items: z.array(cookbookCardSchema) }) },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/cookbooks",
    tags: ["cookbooks"],
    summary: "Create a cookbook",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string(),
              description: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created cookbook",
        content: { "application/json": { schema: cookbookSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/cookbooks/{id}",
    tags: ["cookbooks"],
    summary: "Get a cookbook and its recipes",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Cookbook", content: { "application/json": { schema: cookbookSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/cookbooks/{id}",
    tags: ["cookbooks"],
    summary: "Rename a cookbook",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().optional(),
              description: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated cookbook",
        content: { "application/json": { schema: cookbookSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/cookbooks/{id}",
    tags: ["cookbooks"],
    summary: "Delete a cookbook without deleting its recipes",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  registry.registerPath({
    method: "post",
    path: "/cookbooks/{id}/recipes",
    tags: ["cookbooks"],
    summary: "Add a recipe to a cookbook",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": { schema: z.object({ recipeId: z.string().uuid() }) },
        },
      },
    },
    responses: { 200: { description: "Membership saved" } },
  });

  const personSchema = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      displayName: z.string(),
      sortOrder: z.number().int().nonnegative(),
    })
    .openapi("Person");

  registry.registerPath({
    method: "post",
    path: "/people/reorder",
    tags: ["people"],
    summary: "Set the persistent household people order",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              personIds: z.array(z.string().uuid()).min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "People in the saved order",
        content: { "application/json": { schema: z.object({ items: z.array(personSchema) }) } },
      },
    },
  });

  const preferenceSchema = z
    .object({
      id: z.string().uuid(),
      personId: z.string().uuid(),
      type: z.string(),
      value: z.string(),
      weight: z.number().int(),
    })
    .openapi("Preference");

  registry.registerPath({
    method: "get",
    path: "/people/{id}/preferences",
    tags: ["people"],
    summary: "List a person's preferences, including Loves",
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ type: z.string().optional() }),
    },
    responses: {
      200: {
        description: "Preferences",
        content: { "application/json": { schema: z.array(preferenceSchema) } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/people/{id}/preferences",
    tags: ["people"],
    summary: "Add a preference such as a Love (never filters recipes)",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              type: z.string().optional(),
              value: z.string(),
              weight: z.number().int().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created preference",
        content: { "application/json": { schema: preferenceSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/people/{id}/preferences/{prefId}",
    tags: ["people"],
    summary: "Remove a preference",
    request: { params: z.object({ id: z.string().uuid(), prefId: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  registry.registerPath({
    method: "post",
    path: "/uploads/images",
    tags: ["recipes"],
    summary: "Upload or copy a recipe image into Vercel Blob",
    responses: {
      201: {
        description: "Stored image URL",
        content: { "application/json": { schema: z.object({ url: z.string() }) } },
      },
    },
  });

  const personRuleSchema = z
    .object({
      id: z.string().uuid(),
      personId: z.string().uuid(),
      kind: z.enum(["allergen", "ingredient", "ingredient_category", "diet", "tag", "custom"]),
      target: z.string(),
      severity: z.enum(["block", "warn", "prefer_avoid"]),
      label: z.string().nullable().optional(),
    })
    .openapi("PersonRule");

  registry.registerPath({
    method: "get",
    path: "/people",
    tags: ["people"],
    summary: "List people in the household",
    responses: {
      200: {
        description: "People page",
        content: { "application/json": { schema: z.object({ items: z.array(personSchema) }) } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/people",
    tags: ["people"],
    summary: "Create a person",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({ displayName: z.string(), notes: z.string().optional() }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created person",
        content: { "application/json": { schema: personSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/people/{id}",
    tags: ["people"],
    summary: "Get a person",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Person", content: { "application/json": { schema: personSchema } } },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/people/{id}",
    tags: ["people"],
    summary: "Update a person",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              displayName: z.string().optional(),
              notes: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated person",
        content: { "application/json": { schema: personSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/people/{id}",
    tags: ["people"],
    summary: "Soft-delete a person",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  registry.registerPath({
    method: "get",
    path: "/people/{id}/rules",
    tags: ["people"],
    summary: "List a person's Can't eat / Doesn't like rules",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: "Rules",
        content: { "application/json": { schema: z.array(personRuleSchema) } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/people/{id}/rules",
    tags: ["people"],
    summary: "Add a rule. Not medical advice - always check labels.",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              kind: z.enum([
                "allergen",
                "ingredient",
                "ingredient_category",
                "diet",
                "tag",
                "custom",
              ]),
              target: z.string(),
              severity: z.enum(["block", "warn", "prefer_avoid"]),
              label: z.string().optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created rule",
        content: { "application/json": { schema: personRuleSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/people/{id}/rules/{ruleId}",
    tags: ["people"],
    summary: "Remove a rule",
    request: { params: z.object({ id: z.string().uuid(), ruleId: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  const mealPlanEntrySchema = z
    .object({
      id: z.string().uuid(),
      date: z.string(),
      mealSlot: z.string(),
      recipeId: z.string().uuid().nullable().optional(),
      freeformMeal: z.string().nullable().optional(),
      servings: z.number().int().positive().nullable().optional(),
      attendees: z.array(z.string().uuid()),
      prepAheadNotes: z.string().nullable().optional(),
    })
    .openapi("MealPlanEntry");

  const shoppingTripStateDoc = z
    .object({
      checkedKeys: z.array(z.string()),
      extras: z.array(z.object({ key: z.string(), name: z.string() }).strict()),
    })
    .strict()
    .openapi("ShoppingTripState");

  const shoppingListIngredientDoc = z
    .object({
      key: z.string(),
      checked: z.boolean().optional(),
      name: z.string(),
      quantity: z.number().optional(),
      unit: z.string().optional(),
      displayQuantity: z.string().optional(),
      displayUnit: z
        .string()
        .optional()
        .describe("Unit inflected for the display quantity (`cloves` when the amount is 2)."),
      aisle: z.string(),
      category: z.string(),
      isStaple: z
        .boolean()
        .describe(
          "Canonical kitchen-staple flag (salt, oil, pepper). Distinct from the pantry food-taxonomy category."
        ),
      isPantryItem: z.boolean().describe("Deprecated alias of isStaple."),
      recipes: z.array(
        z.object({
          recipeId: z.string(),
          recipeTitle: z.string(),
          quantity: z.number().optional(),
          unit: z.string().optional(),
        })
      ),
    })
    .openapi("ShoppingListIngredient");

  const shoppingListDoc = z
    .object({
      mealPlanId: z.string(),
      weekStart: z.string(),
      groupBy: z.enum(["aisle", "recipe", "category"]),
      includeStaples: z
        .boolean()
        .describe("Canonical flag for kitchen staples such as salt, pepper, and oil."),
      includePantryItems: z.boolean().describe("Deprecated alias of includeStaples."),
      ingredients: z.array(shoppingListIngredientDoc),
      sections: z.array(
        z.object({
          name: z.string(),
          items: z.array(shoppingListIngredientDoc),
        })
      ),
      itemCount: z.number().int().nonnegative(),
      generatedAt: z.string(),
      warnings: z.array(
        z.object({
          ingredient: z.string(),
          personName: z.string(),
          note: z.string(),
        })
      ),
    })
    .openapi("ShoppingList");

  const mealPlanSchema = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      weekStart: z.string(),
      status: z.enum(["draft", "approved", "archived"]),
      needsRecheck: z.boolean(),
      shoppingState: shoppingTripStateDoc.optional(),
    })
    .openapi("MealPlan");

  const mealPlanDetailSchema = mealPlanSchema
    .extend({
      entries: z.array(mealPlanEntrySchema),
      previousEntries: z
        .array(mealPlanEntrySchema)
        .optional()
        .describe("Nights this PATCH changed, as they were before the edit. Use to revert."),
    })
    .openapi("MealPlanDetail");

  registry.registerPath({
    method: "get",
    path: "/meal-plans",
    tags: ["meal-plans"],
    summary: "List meal plans",
    request: {
      query: z.object({
        weekStart: z.string().optional(),
        weekEnd: z.string().optional(),
        status: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Meal plan page",
        content: { "application/json": { schema: z.object({ items: z.array(mealPlanSchema) }) } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/meal-plans",
    tags: ["meal-plans"],
    summary: "Create a meal plan",
    request: {
      body: {
        content: {
          "application/json": {
            schema: createMealPlanBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created plan",
        content: { "application/json": { schema: mealPlanDetailSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}",
    tags: ["meal-plans"],
    summary: "Get a meal plan",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: "Meal plan",
        content: { "application/json": { schema: mealPlanDetailSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/meal-plans/{id}",
    tags: ["meal-plans"],
    summary: "Update a meal plan",
    description:
      "`entries` default to **merge** by date+meal: send one night to set, swap, or `{ clear: true }` to remove it. Other nights are left alone. Pass `entriesMode: replace` to rewrite the whole week. The response includes `previousEntries` for the nights this request changed.",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: updateMealPlanBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated plan",
        content: { "application/json": { schema: mealPlanDetailSchema } },
      },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/meal-plans/{id}",
    tags: ["meal-plans"],
    summary: "Soft-delete a meal plan",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: "Deleted" } },
  });

  registry.registerPath({
    method: "post",
    path: "/meal-plans/{id}/undo",
    tags: ["meal-plans"],
    summary: "Undo the last entries edit",
    description:
      "Restores the previous week snapshot recorded on merge/replace PATCH. Returns the plan plus previousEntries (the state that was undone).",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Restored plan" },
      404: { description: "Plan or revision not found" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}/history",
    tags: ["meal-plans"],
    summary: "List recent meal-plan entry snapshots (newest first)",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Revision list" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}/check",
    tags: ["meal-plans"],
    summary:
      "Check a meal plan against per-person rules and schedule time budgets. Not medical advice.",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Check report" },
      404: { description: "Meal plan not found (including a malformed id)" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/meal-plans/{id}/check",
    tags: ["meal-plans"],
    summary: "Recheck a meal plan, store the report, and clear needsRecheck. GET is a dry run.",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { description: "Check report" },
      404: { description: "Meal plan not found (including a malformed id)" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}/shopping-list",
    tags: ["meal-plans"],
    summary: "Export a shopping list for a meal plan",
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({
        format: z.enum(["json", "csv", "markdown", "text"]).optional(),
        groupBy: z.enum(["aisle", "recipe", "category"]).optional(),
        includeStaples: z.coerce
          .boolean()
          .optional()
          .describe(
            "Include kitchen staples such as salt, pepper, and oil. Distinct from the pantry food-taxonomy category (flour, canned goods). Alias: includePantryItems."
          ),
        includePantryItems: z.coerce
          .boolean()
          .optional()
          .describe("Deprecated alias for includeStaples."),
        timeZone: z
          .string()
          .optional()
          .describe(
            "IANA timezone for markdown/text Generated labels (for example America/Chicago). Always includes a zone abbreviation."
          ),
      }),
    },
    responses: {
      200: {
        description:
          "Shopping list. JSON is the ShoppingList object (includeStaples / isStaple canonical; includePantryItems / isPantryItem aliases). Markdown/text stamp check-offs and extras.",
        content: { "application/json": { schema: shoppingListDoc } },
      },
      400: { description: "Invalid format, groupBy, or timeZone" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}/shopping-list/state",
    tags: ["meal-plans"],
    summary: "Get saved check-offs and extras for this plan week",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: "Saved shopping trip state",
        content: { "application/json": { schema: shoppingTripStateDoc } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/meal-plans/{id}/shopping-list/state",
    tags: ["meal-plans"],
    summary: "Save check-offs and extras for this plan week",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: shoppingTripStateDoc,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Saved shopping trip state",
        content: { "application/json": { schema: shoppingTripStateDoc } },
      },
      400: { description: "Unknown keys or invalid check-off payload" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/households",
    tags: ["households"],
    summary: "Get the authenticated household",
    responses: { 200: { description: "Household" } },
  });

  const householdServingsSettingsSchema = z
    .object({
      mode: z.enum(["family", "fixed", "recipe"]),
      servings: z.number().int().min(1).max(24).nullable(),
      familySize: z.number().int().nonnegative(),
      defaultCookFor: z.number().int().min(1).max(24),
    })
    .openapi("HouseholdServingsSettings");

  registry.registerPath({
    method: "get",
    path: "/households/settings",
    tags: ["households"],
    summary: "Get kitchen Default servings",
    description:
      "family matches max(recipe yield, People count). fixed uses servings. recipe keeps the card yield.",
    responses: {
      200: {
        description: "Default servings setting",
        content: { "application/json": { schema: householdServingsSettingsSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/households/settings",
    tags: ["households"],
    summary: "Update kitchen Default servings",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              mode: z.enum(["family", "fixed", "recipe"]),
              servings: z.number().int().min(1).max(24).optional().nullable(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated Default servings setting",
        content: { "application/json": { schema: householdServingsSettingsSchema } },
      },
    },
  });

  const weeklyNightSchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    day: z.string(),
    meal: z.string(),
    busyLevel: z.enum(["low", "medium", "high"]),
    timeBudgetMinutes: z.number().int().positive(),
    cooking: z.boolean(),
    attendees: z.array(z.string()),
    constraints: z.array(z.string()),
  });

  const householdScheduleSchema = z
    .object({
      weeklyTemplate: z.array(weeklyNightSchema),
      overrides: z.array(
        z.object({
          date: z.string(),
          meal: z.string(),
          note: z.string(),
        })
      ),
    })
    .openapi("HouseholdSchedule");

  registry.registerPath({
    method: "get",
    path: "/households/schedule",
    tags: ["households"],
    summary: "Get the household weekly availability and busy-night schedule",
    responses: {
      200: {
        description: "Weekly schedule",
        content: { "application/json": { schema: householdScheduleSchema } },
      },
    },
  });

  registry.registerPath({
    method: "put",
    path: "/households/schedule",
    tags: ["households"],
    summary: "Replace the household weekly availability and busy-night schedule",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              week: z.array(
                z.object({
                  dayOfWeek: z.number().int().min(0).max(6).optional(),
                  day: z.string().optional(),
                  busyLevel: z.enum(["low", "medium", "high"]).optional(),
                  timeBudgetMinutes: z.number().int().positive().optional(),
                  cooking: z.boolean().optional(),
                })
              ),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated schedule",
        content: { "application/json": { schema: householdScheduleSchema } },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api-keys",
    tags: ["api-keys"],
    summary: "List API keys (hashes only)",
    responses: { 200: { description: "API keys" } },
  });

  registry.registerPath({
    method: "post",
    path: "/api-keys",
    tags: ["api-keys"],
    summary: "Create an API key. The plaintext is returned once.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              name: z.string().optional(),
              scopes: z.array(z.string()).optional(),
            }),
          },
        },
      },
    },
    responses: { 201: { description: "Created key with plaintext" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api-keys/{id}",
    tags: ["api-keys"],
    summary: "Revoke an API key",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 204: { description: "Revoked" } },
  });

  const inviteRoleDoc = z.enum(["admin", "member", "viewer"]).openapi("InviteRole");
  const membershipRoleDoc = z
    .enum(["owner", "admin", "member", "viewer"])
    .openapi("MembershipRole");
  const kitchenMemberDoc = z
    .object({
      membershipId: z.string().uuid(),
      userId: z.string().uuid(),
      email: z.string().email(),
      displayName: z.string().nullable(),
      role: membershipRoleDoc,
      createdAt: z.string().datetime(),
    })
    .openapi("KitchenMember");
  const kitchenInviteDoc = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      token: z.string(),
      url: z.string().optional(),
      role: inviteRoleDoc,
      expiresAt: z.string().datetime(),
      revokedAt: z.string().datetime().nullable().optional(),
      createdAt: z.string().datetime(),
    })
    .openapi("KitchenInvite");
  const kitchenInvitePreviewDoc = z
    .object({
      householdId: z.string().uuid(),
      householdName: z.string(),
      role: inviteRoleDoc,
      expiresAt: z.string().datetime(),
      status: z.enum(["pending", "expired", "revoked"]),
    })
    .openapi("KitchenInvitePreview");

  registry.registerPath({
    method: "get",
    path: "/households/mine",
    tags: ["households"],
    summary:
      "List kitchens. Signed-in users see every kitchen they belong to. An API key sees only its own kitchen, read-only, with active: true.",
    responses: {
      200: {
        description:
          "Kitchens with an `active` flag. `activeHouseholdId` is the current kitchen. API keys cannot switch.",
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/households/select",
    tags: ["households"],
    summary:
      "Switch the active kitchen for this browser session. Signed-in users only; API keys are bound to one kitchen.",
    request: {
      body: {
        content: {
          "application/json": { schema: z.object({ householdId: z.string().uuid() }) },
        },
      },
    },
    responses: { 200: { description: "Selected kitchen" } },
  });

  registry.registerPath({
    method: "get",
    path: "/households/members",
    tags: ["households"],
    summary: "List kitchen members (signed-in users, not People)",
    responses: {
      200: {
        description: "Members",
        content: {
          "application/json": { schema: z.object({ items: z.array(kitchenMemberDoc) }) },
        },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/households/members/{userId}",
    tags: ["households"],
    summary: "Change a kitchen member role (owner only)",
    request: {
      params: z.object({ userId: z.string().uuid() }),
      body: {
        content: { "application/json": { schema: z.object({ role: membershipRoleDoc }) } },
      },
    },
    responses: { 200: { description: "Updated membership" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/households/members/{userId}",
    tags: ["households"],
    summary: "Remove a kitchen member (owner only)",
    request: { params: z.object({ userId: z.string().uuid() }) },
    responses: { 204: { description: "Removed" } },
  });

  registry.registerPath({
    method: "post",
    path: "/households/leave",
    tags: ["households"],
    summary: "Leave the active kitchen",
    responses: { 200: { description: "Left kitchen" } },
  });

  registry.registerPath({
    method: "get",
    path: "/households/invites",
    tags: ["households"],
    summary: "List pending kitchen invite links (owner, admin, or API key)",
    responses: {
      200: {
        description: "Pending invites",
        content: {
          "application/json": { schema: z.object({ items: z.array(kitchenInviteDoc) }) },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/households/invites",
    tags: ["households"],
    summary: "Create a shareable kitchen invite link (owner, admin, or API key)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              role: inviteRoleDoc.optional(),
              expiresInDays: z.number().int().min(1).max(30).optional(),
            }),
          },
        },
      },
    },
    responses: { 201: { description: "Created invite with url" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/households/invites/{id}",
    tags: ["households"],
    summary: "Revoke a kitchen invite link (owner, admin, or API key)",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { description: "Revoked invite" } },
  });

  registry.registerPath({
    method: "get",
    path: "/invites/{token}",
    tags: ["households"],
    summary: "Preview a kitchen invite link (no auth)",
    security: [],
    request: { params: z.object({ token: z.string() }) },
    responses: {
      200: {
        description: "Invite preview",
        content: { "application/json": { schema: kitchenInvitePreviewDoc } },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/invites/{token}/accept",
    tags: ["households"],
    summary:
      "Accept a kitchen invite for the signed-in user. API keys cannot join another kitchen; the error names the /invite/{token} link a person must open.",
    request: { params: z.object({ token: z.string() }) },
    responses: {
      200: { description: "Joined kitchen" },
      401: {
        description:
          "Signed-in user required. An API key cannot accept; the problem detail includes the invite link.",
      },
    },
  });
}
