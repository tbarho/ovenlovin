import { NextRequest } from "next/server";
import type { RequestContext } from "@/lib/api/middleware";
import { enforceDemoRequestGuards } from "./enforce";

const WRITE_TOOLS = new Set([
  "import_recipe",
  "import_recipe_from_image",
  "create_recipe",
  "delete_recipe",
  "save_meal_plan",
  "delete_meal_plan",
  "manage_cookbook",
  "manage_people",
  "manage_person_rules",
  "manage_person_loves",
  "reorder_people",
  "manage_household_schedule",
  "manage_household_settings",
]);

export async function enforceDemoMcpGuards(
  request: NextRequest,
  householdId: string,
  body: unknown
): Promise<void> {
  const message = body as { method?: string; params?: { name?: string } };
  if (message.method !== "tools/call") return;
  const name = message.params?.name ?? "";
  if (!WRITE_TOOLS.has(name)) return;

  const url = new URL(request.url);
  url.pathname =
    name === "import_recipe" || name === "import_recipe_from_image"
      ? "/api/v1/recipes/import"
      : `/mcp/${name}`;
  const synthetic = new NextRequest(url, { method: "POST", headers: request.headers });
  const context: RequestContext = { householdId, isBot: true };
  await enforceDemoRequestGuards(synthetic, context);
}

export function isSuccessfulImportRecipeCall(
  body: unknown,
  resultBody: string | undefined
): boolean {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const message = body as { method?: string; params?: { name?: string } };
  if (
    message.method !== "tools/call" ||
    (message.params?.name !== "import_recipe" &&
      message.params?.name !== "import_recipe_from_image")
  ) {
    return false;
  }
  if (!resultBody) return false;
  try {
    const parsed = JSON.parse(resultBody) as { error?: unknown };
    return parsed.error == null;
  } catch {
    return false;
  }
}
