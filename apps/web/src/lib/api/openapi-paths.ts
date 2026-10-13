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
    method: "get",
    path: "/recipes/{id}",
    tags: ["recipes"],
    summary: "Get a recipe with ingredients, steps, times, images, and source",
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
}
