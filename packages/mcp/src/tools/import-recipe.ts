/**
 * Tool: import_recipe
 * 
 * Import a recipe from URL, paste, or file
 */

import { z } from "zod";
import type { AuthContext } from "../auth/index.js";

export const importRecipeSchema = z.object({
  source: z.enum(["url", "paste"]),
  content: z.string().describe("URL or pasted recipe text"),
  skipReview: z.boolean().default(false).describe("Skip review queue and publish immediately"),
});

export type ImportRecipeInput = z.infer<typeof importRecipeSchema>;

export interface ImportRecipeOutput {
  recipeId: string;
  status: "draft" | "needs_review" | "published";
  confidence: number;
  lowConfidenceFields?: string[];
  message: string;
}

async function handler(
  _input: ImportRecipeInput,
  _context: AuthContext
): Promise<ImportRecipeOutput> {
  // TODO: Implement using @ovenlovin/importers (when merged)
  // - Queue import job
  // - Return job ID and initial status
  // - Actual import runs async via eve agent
  
  throw new Error("Not implemented: import_recipe - depends on @ovenlovin/importers");
}

export const importRecipeTool = {
  name: "import_recipe",
  description: "Import a recipe from a URL or pasted text. Returns a draft recipe that may need review if confidence is low.",
  inputSchema: importRecipeSchema,
  handler,
} as const;
