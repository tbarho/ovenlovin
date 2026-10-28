import type { ApiKeyScope } from "../schemas/households";

/** MCP resources (profile, schedule, people) use this same scope. */
export const MCP_RESOURCE_SCOPE = "people:read" as const satisfies ApiKeyScope;

export function missingScopeMessage(scope: string): string {
  return `This API key is missing the ${scope} scope. Create a new key in Settings with that scope (or omit scopes for full access).`;
}

/**
 * REST method + path. `{param}` is one segment. `null` means any authenticated key.
 * Unknown paths deny. Clerk sessions never consult this table.
 */
export const REST_SCOPE_TABLE = [
  { method: "GET", path: "/health", scope: null },
  { method: "GET", path: "/status", scope: null },
  { method: "GET", path: "/openapi.json", scope: null },
  { method: "GET", path: "/invites/{token}", scope: null },

  { method: "GET", path: "/recipes", scope: "recipes:read" },
  { method: "POST", path: "/recipes", scope: "recipes:write" },
  { method: "GET", path: "/recipes/{id}", scope: "recipes:read" },
  { method: "PATCH", path: "/recipes/{id}", scope: "recipes:write" },
  { method: "DELETE", path: "/recipes/{id}", scope: "recipes:write" },
  { method: "POST", path: "/recipes/{id}/restore", scope: "recipes:write" },
  { method: "GET", path: "/recipes/{id}/image", scope: "recipes:read" },
  { method: "POST", path: "/recipes/{id}/image", scope: "recipes:write" },
  { method: "POST", path: "/recipes/import", scope: "recipes:write" },
  { method: "POST", path: "/recipes/import/page", scope: "recipes:write" },
  { method: "POST", path: "/recipes/import/photo", scope: "recipes:write" },

  { method: "GET", path: "/cookbooks", scope: "recipes:read" },
  { method: "POST", path: "/cookbooks", scope: "recipes:write" },
  { method: "GET", path: "/cookbooks/{id}", scope: "recipes:read" },
  { method: "PATCH", path: "/cookbooks/{id}", scope: "recipes:write" },
  { method: "DELETE", path: "/cookbooks/{id}", scope: "recipes:write" },
  { method: "POST", path: "/cookbooks/{id}/recipes", scope: "recipes:write" },
  { method: "DELETE", path: "/cookbooks/{id}/recipes", scope: "recipes:write" },
  { method: "POST", path: "/cookbooks/{id}/pdf", scope: "recipes:write" },
  { method: "GET", path: "/cookbooks/{id}/pdf/{jobId}", scope: "recipes:read" },
  { method: "GET", path: "/cookbooks/{id}/pdf/{jobId}/download", scope: "recipes:read" },
  { method: "GET", path: "/cookbooks/{id}/share", scope: "recipes:read" },
  { method: "POST", path: "/cookbooks/{id}/share", scope: "recipes:write" },
  { method: "DELETE", path: "/cookbooks/{id}/share", scope: "recipes:write" },
  { method: "POST", path: "/books/upload", scope: "recipes:write" },
  { method: "POST", path: "/books/imports", scope: "recipes:write" },
  { method: "POST", path: "/books/photos", scope: "recipes:write" },
  { method: "GET", path: "/books/imports/{id}", scope: "recipes:read" },
  { method: "PATCH", path: "/books/imports/{id}", scope: "recipes:write" },
  { method: "POST", path: "/books/imports/{id}", scope: "recipes:write" },
  { method: "POST", path: "/books/imports/{id}/recipes", scope: "recipes:write" },
  { method: "POST", path: "/uploads/images", scope: "recipes:write" },

  { method: "GET", path: "/meal-plans", scope: "plans:read" },
  { method: "POST", path: "/meal-plans", scope: "plans:write" },
  { method: "GET", path: "/meal-plans/{id}", scope: "plans:read" },
  { method: "PATCH", path: "/meal-plans/{id}", scope: "plans:write" },
  { method: "DELETE", path: "/meal-plans/{id}", scope: "plans:write" },
  { method: "GET", path: "/meal-plans/{id}/check", scope: "plans:read" },
  { method: "POST", path: "/meal-plans/{id}/check", scope: "plans:write" },
  { method: "GET", path: "/meal-plans/{id}/history", scope: "plans:read" },
  { method: "POST", path: "/meal-plans/{id}/undo", scope: "plans:write" },
  { method: "GET", path: "/meal-plans/{id}/shopping-list", scope: "lists:export" },
  { method: "GET", path: "/meal-plans/{id}/shopping-list/state", scope: "lists:export" },
  { method: "PATCH", path: "/meal-plans/{id}/shopping-list/state", scope: "lists:export" },

  { method: "GET", path: "/people", scope: "people:read" },
  { method: "POST", path: "/people", scope: "people:write" },
  { method: "GET", path: "/people/{id}", scope: "people:read" },
  { method: "PATCH", path: "/people/{id}", scope: "people:write" },
  { method: "DELETE", path: "/people/{id}", scope: "people:write" },
  { method: "POST", path: "/people/reorder", scope: "people:write" },
  { method: "GET", path: "/people/{id}/rules", scope: "people:read" },
  { method: "POST", path: "/people/{id}/rules", scope: "people:write" },
  { method: "GET", path: "/people/{id}/rules/{ruleId}", scope: "people:read" },
  { method: "PATCH", path: "/people/{id}/rules/{ruleId}", scope: "people:write" },
  { method: "DELETE", path: "/people/{id}/rules/{ruleId}", scope: "people:write" },
  { method: "GET", path: "/people/{id}/preferences", scope: "people:read" },
  { method: "POST", path: "/people/{id}/preferences", scope: "people:write" },
  { method: "GET", path: "/people/{id}/preferences/{prefId}", scope: "people:read" },
  { method: "DELETE", path: "/people/{id}/preferences/{prefId}", scope: "people:write" },

  { method: "GET", path: "/households", scope: "people:read" },
  { method: "PATCH", path: "/households", scope: "people:write" },
  { method: "GET", path: "/households/mine", scope: "people:read" },
  { method: "POST", path: "/households/select", scope: "people:write" },
  { method: "GET", path: "/households/settings", scope: "people:read" },
  { method: "PATCH", path: "/households/settings", scope: "people:write" },
  { method: "GET", path: "/households/schedule", scope: "people:read" },
  { method: "PUT", path: "/households/schedule", scope: "people:write" },
  { method: "GET", path: "/households/members", scope: "people:read" },
  { method: "PATCH", path: "/households/members/{userId}", scope: "people:write" },
  { method: "DELETE", path: "/households/members/{userId}", scope: "people:write" },
  { method: "POST", path: "/households/leave", scope: "people:write" },
  { method: "GET", path: "/households/invites", scope: "people:read" },
  { method: "POST", path: "/households/invites", scope: "people:write" },
  { method: "DELETE", path: "/households/invites/{id}", scope: "people:write" },
  { method: "POST", path: "/invites/{token}/accept", scope: "people:write" },

  // Session-only: requireUserId rejects keys after this null gate.
  { method: "GET", path: "/api-keys", scope: null },
  { method: "POST", path: "/api-keys", scope: null },
  { method: "DELETE", path: "/api-keys/{id}", scope: null },
] as const satisfies ReadonlyArray<{
  method: string;
  path: string;
  scope: ApiKeyScope | null;
}>;

export const MCP_SCOPE_TABLE = {
  whoami: null,
  search_recipes: "recipes:read",
  get_recipe: "recipes:read",
  create_recipe: "recipes:write",
  import_recipe: "recipes:write",
  import_recipe_from_image: "recipes:write",
  delete_recipe: "recipes:write",
  list_cookbooks: "recipes:read",
  get_cookbook: "recipes:read",
  manage_cookbook: "recipes:write",
  get_household_context: "people:read",
  manage_household_schedule: "people:write",
  manage_household_settings: "people:write",
  manage_kitchen_invites: "people:write",
  manage_kitchen_members: "people:write",
  get_person_rules: "people:read",
  manage_people: "people:write",
  manage_person_rules: "people:write",
  manage_person_loves: "people:write",
  reorder_people: "people:write",
  check_meal_plan: "plans:read",
  get_meal_plan: "plans:read",
  save_meal_plan: "plans:write",
  edit_meal_plan: "plans:write",
  delete_meal_plan: "plans:write",
  export_shopping_list: "lists:export",
} as const satisfies Record<string, ApiKeyScope | null>;

function restPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  if (trimmed === "/api/v1") return "/";
  return trimmed.startsWith("/api/v1/") ? trimmed.slice("/api/v1".length) : trimmed;
}

function pathMatches(pattern: string, path: string): boolean {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => {
    const segment = pathParts[index];
    return Boolean(segment) && (part.startsWith("{") || part.startsWith(":") || part === segment);
  });
}

export function requiredRestScope(
  method: string,
  pathname: string
): ApiKeyScope | null | undefined {
  const path = restPath(pathname);
  const verb = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
  const row = REST_SCOPE_TABLE.find(
    (entry) => entry.method === verb && pathMatches(entry.path, path)
  );
  return row ? row.scope : undefined;
}

export function restApiKeyScopeDenial(
  scopes: readonly string[],
  method: string,
  pathname: string
): string | null {
  const required = requiredRestScope(method, pathname);
  if (required === null) return null;
  if (required === undefined) {
    return `This API key cannot call ${method.toUpperCase()} ${pathname}. No scope grants this route.`;
  }
  return scopes.includes(required) ? null : missingScopeMessage(required);
}

export function mcpApiKeyScopeDenial(scopes: readonly string[], toolName: string): string | null {
  if (!Object.hasOwn(MCP_SCOPE_TABLE, toolName)) {
    return `This API key cannot call ${toolName}. No scope grants this tool.`;
  }
  const required = MCP_SCOPE_TABLE[toolName as keyof typeof MCP_SCOPE_TABLE];
  if (!required) return null;
  return scopes.includes(required) ? null : missingScopeMessage(required);
}
