import { NextRequest } from "next/server";
import type { RequestContext } from "@/lib/api/middleware";
import { enforceDemoRequestGuards } from "./enforce";

const WRITE_TOOLS = new Set([
  "import_recipe",
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
  url.pathname = name === "import_recipe" ? "/api/v1/recipes/import" : `/mcp/${name}`;
  const synthetic = new NextRequest(url, { method: "POST", headers: request.headers });
  const context: RequestContext = { householdId, isBot: true };
  await enforceDemoRequestGuards(synthetic, context);
}
