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

  registry.registerPath({
    method: "get",
    path: "/recipes/{id}",
    tags: ["recipes"],
    summary: "Get a recipe with ingredients, steps, times, notes, images, and source",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        description: "Recipe details",
        content: { "application/json": { schema: recipeSchema } },
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
    path: "/recipes/import",
    tags: ["recipes"],
    summary: "Import a recipe from a URL or pasted text, copying the main image into Vercel Blob",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              source: z.enum(["url", "paste"]),
              content: z.string(),
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
      "Extract a recipe from one or more photos (review by default). Multipart upload or a Blob/image URL. Saves only the first photo as the main image.",
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
    summary: "Add a rule. Not medical advice — always check labels.",
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
      extras: z.array(z.object({ key: z.string(), name: z.string() })),
    })
    .openapi("ShoppingTripState");

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
    summary:
      "Check a meal plan against per-person rules and schedule time budgets. Same as GET; POST is kept for existing clients.",
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
      }),
    },
    responses: { 200: { description: "Shopping list" } },
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
    },
  });

  registry.registerPath({
    method: "get",
    path: "/households",
    tags: ["households"],
    summary: "Get the authenticated household",
    responses: { 200: { description: "Household" } },
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
}
