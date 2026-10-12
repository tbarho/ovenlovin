import { Command } from "commander";
import { createDbClient } from "@ovenlovin/db/client";
import { RecipeService } from "@ovenlovin/core";
import { createUrlImporter, createPasteImporter } from "@ovenlovin/importers";
import { readFileSync } from "fs";

export function importCommand() {
  const cmd = new Command("import")
    .description("Import recipes from various sources")
    .requiredOption("-h, --household-id <id>", "Household ID")
    .requiredOption("-u, --user-id <id>", "User ID (created_by)");

  cmd
    .command("url")
    .description("Import a recipe from a URL")
    .argument("<url>", "Recipe URL")
    .action(async (url, options, command) => {
      const parentOpts = command.parent?.opts();
      await runImport("url", url, parentOpts.householdId, parentOpts.userId);
    });

  cmd
    .command("paste")
    .description("Import a recipe from pasted text")
    .option("-f, --file <path>", "Read from file instead of stdin")
    .action(async (options, command) => {
      const parentOpts = command.parent?.opts();
      const text = options.file ? readFileSync(options.file, "utf-8") : await readStdin();
      await runImport("paste", text, parentOpts.householdId, parentOpts.userId);
    });

  return cmd;
}

async function runImport(type: string, input: string, householdId: string, userId: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Error: DATABASE_URL not set");
    process.exit(1);
  }

  const db = createDbClient(connectionString);
  const recipeService = new RecipeService(db);

  try {
    console.log(`\n📥 Importing from ${type}...`);

    const importerMap = {
      url: createUrlImporter(),
      paste: createPasteImporter(),
    };
    const importer = importerMap[type as keyof typeof importerMap];
    if (!importer) {
      console.error(`Error: Unknown importer type: ${type}`);
      process.exit(1);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (importer as any).import(input);

    if (result.status === "error") {
      console.error(`❌ Import failed: ${result.error || "Unknown error"}`);
      process.exit(1);
    }

    if (!result.recipe) {
      console.error("❌ Import failed: No recipe data");
      process.exit(1);
    }

    const importedRecipe = result.recipe;
    console.log(`✅ Parsed: ${importedRecipe.title}`);
    console.log(`   Servings: ${importedRecipe.servings ?? "N/A"}`);
    console.log(`   Ingredients: ${(importedRecipe.ingredients || []).length}`);
    console.log(`   Steps: ${importedRecipe.steps.length}`);

    const slug = importedRecipe.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const created = await recipeService.createRecipe({
      householdId,
      title: importedRecipe.title,
      slug,
      description: importedRecipe.description ?? null,
      servings: importedRecipe.servings ?? null,
      prepTimeMinutes: importedRecipe.prepTimeMinutes ?? null,
      cookTimeMinutes: importedRecipe.cookTimeMinutes ?? null,
      totalTimeMinutes: importedRecipe.totalTimeMinutes ?? null,
      cuisine: importedRecipe.cuisine ?? null,
      course: importedRecipe.course ?? null,
      methodTags: [],
      equipment: [],
      images: [],
      status: "draft",
      visibility: "private",
      version: 1,
      isFamilyRecipe: false,
      createdBy: userId,
    });

    console.log(`\n✨ Recipe saved: ${created.id}`);
    console.log(`   Status: ${created.status}`);
    process.exit(0);
  } catch (error) {
    console.error(`Error importing recipe: ${error}`);
    process.exit(1);
  }
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      resolve(data);
    });
  });
}
