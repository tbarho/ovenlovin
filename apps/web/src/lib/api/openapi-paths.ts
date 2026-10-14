import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
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

  registry.registerPath({
    method: "get",
    path: "/recipes",
    tags: ["recipes"],
    summary: "List recipes",
    request: {
      query: z.object({
        limit: z.coerce.number().int().positive().max(100).optional(),
        cursor: z.string().optional(),
        search: z.string().optional(),
        forAttendees: z
          .string()
          .optional()
          .describe(
            "Comma-separated person IDs. Recipes that hit a block rule for any attendee are omitted."
          ),
        cookbookId: z.string().uuid().optional(),
        uncategorized: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "Recipe page",
        content: { "application/json": { schema: z.object({ items: z.array(recipeSchema) }) } },
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

  const mealPlanSchema = z
    .object({
      id: z.string().uuid(),
      householdId: z.string().uuid(),
      weekStart: z.string(),
      status: z.enum(["draft", "approved", "archived"]),
      needsRecheck: z.boolean(),
    })
    .openapi("MealPlan");

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
            schema: z.object({
              weekStart: z.string(),
              status: z.enum(["draft", "approved"]).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created plan",
        content: { "application/json": { schema: mealPlanSchema } },
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
        content: { "application/json": { schema: mealPlanSchema } },
      },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/meal-plans/{id}",
    tags: ["meal-plans"],
    summary: "Update a meal plan",
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.enum(["draft", "approved", "archived"]).optional(),
              acknowledgedWarnings: z.array(z.string()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated plan",
        content: { "application/json": { schema: mealPlanSchema } },
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
    summary: "Check a meal plan against per-person rules. Not medical advice.",
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: { 200: { description: "Check report" } },
  });

  registry.registerPath({
    method: "get",
    path: "/meal-plans/{id}/shopping-list",
    tags: ["meal-plans"],
    summary: "Export a shopping list for a meal plan",
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ format: z.enum(["json", "csv", "markdown", "text"]).optional() }),
    },
    responses: { 200: { description: "Shopping list" } },
  });

  registry.registerPath({
    method: "get",
    path: "/households",
    tags: ["households"],
    summary: "Get the authenticated household",
    responses: { 200: { description: "Household" } },
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
