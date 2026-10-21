import { listedTools } from "@ovenlovin/mcp";
import { generateOpenApiDocument } from "./api/openapi";

const PITCH = "The family recipe box your AI can actually use, and it knows who can't eat what.";

const DEMO_HOST = "https://ovenlovin-demo.vercel.app";

function restLines(origin: string): string[] {
  const spec = generateOpenApiDocument(origin);
  const lines: string[] = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    if (!item || typeof item !== "object") continue;
    const methods = (["get", "post", "put", "patch", "delete"] as const)
      .filter((method) => item[method])
      .map((method) => method.toUpperCase());
    if (methods.length === 0) continue;
    lines.push(`- ${methods.join("/")} /api/v1${path}`);
  }
  return lines;
}

function mcpLines(): string[] {
  return listedTools().map((tool) => `- ${tool.name}`);
}

export function buildLlmsTxt(origin: string): string {
  const base = origin.replace(/\/$/, "") || "https://ovenlovin.vercel.app";
  return [
    `# OvenLovin`,
    ``,
    `> ${PITCH}`,
    ``,
    `Open-source recipe box and meal planner for families and their AI agents.`,
    `Per-person allergen checks (US Big 9 + EU 14). MIT license.`,
    `Not medical advice. Always check ingredient labels before serving.`,
    ``,
    `## This instance`,
    ``,
    `- Home: ${base}/`,
    `- Recipes: ${base}/recipes`,
    `- Plans: ${base}/plans`,
    `- List: ${base}/list`,
    `- Settings: ${base}/settings`,
    `- Docs: ${base}/docs`,
    `- Connect your agent: ${base}/docs/connect-your-agent`,
    `- MCP (Streamable HTTP): ${base}/mcp`,
    `- REST: ${base}/api/v1`,
    `- OpenAPI: ${base}/api/v1/openapi.json`,
    ``,
    `## Auth`,
    ``,
    `Send one of:`,
    `- \`Authorization: ApiKey rkapi_...\``,
    `- \`Authorization: Bearer rkapi_...\``,
    `- \`Authorization: Bearer <Clerk JWT>\``,
    ``,
    `Create a key in Settings, or copy the sandbox key on the public demo. Clerk JWT MCP uses a kitchen you already belong to (open the app in the browser once). On MCP with a Clerk JWT, optional \`X-Kitchen-Id\` selects a kitchen you belong to. An API key is bound to one kitchen; a mismatched \`X-Kitchen-Id\` is \`403\`.`,
    `A request outside the key's scopes returns 403.`,
    `Unauthenticated REST returns problem+json 401.`,
    `Unauthenticated MCP POST returns a JSON-RPC error envelope (HTTP 401).`,
    ``,
    `No account? \`curl '${DEMO_HOST}/api/demo/enter?format=json'\` returns a sandbox \`apiKey\` (valid 24h; each call creates a new sandbox). Use it with ${DEMO_HOST}/api/v1 and ${DEMO_HOST}/mcp.`,
    `GET /api/demo/reset and GET /api/cron/demo-cleanup are internal.`,
    ``,
    `## Example`,
    ``,
    `curl -H 'Authorization: ApiKey $KEY' ${base}/api/v1/recipes?limit=5`,
    ``,
    `## MCP tools`,
    ``,
    ...mcpLines(),
    ``,
    `## REST`,
    ``,
    ...restLines(base),
    ``,
    `GET /api/v1/meal-plans/{id}/check only reads. POST /api/v1/meal-plans/{id}/check saves the report on the plan.`,
    `There is no llms-full.txt; use /api/v1/openapi.json.`,
    ``,
    `## Safety`,
    ``,
    `Rule checking is deterministic and per-person. Findings name the person, rule, ingredient, and reason.`,
    `Incomplete checks return status: incomplete - never "no issues".`,
    `This is not medical advice. Always read labels.`,
    ``,
    `## Full docs`,
    ``,
    `- ${base}/docs`,
    `- Quickstart: https://tbarho.github.io/ovenlovin/docs/quickstart/`,
    `- REST reference: https://tbarho.github.io/ovenlovin/docs/reference/api/`,
    `- MCP tools: https://tbarho.github.io/ovenlovin/docs/reference/mcp/`,
    `- Kitchen invites: https://tbarho.github.io/ovenlovin/docs/kitchen-invites/`,
    `- Self-hosting: https://tbarho.github.io/ovenlovin/docs/self-hosting/`,
    `- https://tbarho.github.io/ovenlovin/`,
    ``,
  ].join("\n");
}

export const OVENLOVIN_PITCH = PITCH;
