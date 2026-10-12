/**
 * Tool: search_recipes
 *
 * Search for recipes with filters
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index";

export const searchRecipesSchema = z.object({
  query: z.string().optional(),
  forAttendees: z
    .array(z.string())
    .optional()
    .describe("Filter out recipes with blocking rules for these person IDs"),
  methodTags: z.array(z.string()).optional(),
  maxResults: z.number().int().positive().default(20),
  cursor: z.string().optional(),
});

export type SearchRecipesInput = z.infer<typeof searchRecipesSchema>;

export interface SearchRecipesOutput {
  recipes: Array<{
    id: string;
    title: string;
    description?: string;
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    servings?: number;
    methodTags: string[];
    images: string[];
    warnings?: Array<{
      personId: string;
      severity: "block" | "warn" | "prefer_avoid";
      message: string;
    }>;
  }>;
  nextCursor?: string;
}

async function handler(
  _input: SearchRecipesInput,
  _context: AuthContext
): Promise<SearchRecipesOutput> {
  // TODO: Implement using @ovenlovin/core service
  // - Query recipes from DB
  // - If forAttendees provided, check rules and annotate warnings
  // - Return paginated results
  console.log("Search recipes with:", input);

  return {
    recipes: [],
    nextCursor: undefined,
  };
}

export const searchRecipesTool = {
  name: "search_recipes",
  description:
    "Search for recipes with optional filters. Can exclude recipes with blocking rules for specific attendees and annotate warnings.",
  inputSchema: searchRecipesSchema,
  handler,
} as const;
