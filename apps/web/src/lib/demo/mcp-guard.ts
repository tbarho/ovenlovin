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

const READ_ACTIONS = new Set(["get", "list"]);
const DEFAULT_READ_ACTION: Record<string, string> = {
  manage_household_settings: "get",
  manage_household_schedule: "get",
};

export function isDemoMcpWriteCall(body: unknown): boolean {
  const message = body as {
    method?: string;
    params?: { name?: string; arguments?: { action?: unknown; save?: unknown } };
  };
  if (message.method !== "tools/call") return false;
  const name = message.params?.name ?? "";
  if (!WRITE_TOOLS.has(name)) return false;
  const args = message.params?.arguments ?? {};
  if ((name === "import_recipe" || name === "import_recipe_from_image") && args.save === false) {
    return false;
  }
  const action = typeof args.action === "string" ? args.action : (DEFAULT_READ_ACTION[name] ?? "");
  return !READ_ACTIONS.has(action);
}

export async function enforceDemoMcpGuards(
  request: NextRequest,
  householdId: string,
  body: unknown
): Promise<void> {
  const message = body as { method?: string; params?: { name?: string } };
  if (message.method !== "tools/call") return;
  const name = message.params?.name ?? "";
  if (!isDemoMcpWriteCall(body)) return;

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
    const parsed = JSON.parse(resultBody) as {
      error?: unknown;
      result?: { content?: Array<{ text?: string }> | { created?: unknown } };
    };
    if (parsed.error != null) return false;
    const content = parsed.result?.content;
    const texts = Array.isArray(content)
      ? content.map((part) => part.text).filter((text): text is string => typeof text === "string")
      : [];
    for (const text of texts) {
      try {
        const inner = JSON.parse(text) as { created?: unknown };
        if (inner.created === false) return false;
      } catch {
        if (/"created"\s*:\s*false/.test(text)) return false;
      }
    }
    if (
      parsed.result &&
      !Array.isArray(parsed.result.content) &&
      (parsed.result as { created?: unknown }).created === false
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
