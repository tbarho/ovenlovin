export type AgentGuideId = "grok" | "claude" | "chatgpt" | "mcp";

export type AgentGuide = {
  id: AgentGuideId;
  label: string;
  summary: string;
  steps: string[];
  copyLabel: string;
  content: string;
};

export function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "") || "https://your-app.vercel.app";
}

export function buildRecimeMigratePrompt(input: {
  origin: string;
  apiKey?: string | null;
}): string {
  const origin = normalizeOrigin(input.origin);
  const apiKey = input.apiKey?.trim() || "YOUR_OVENLOVIN_API_KEY";
  const mcpUrl = `${origin}/mcp`;
  const apiUrl = `${origin}/api/v1`;

  return [
    `Migrate this household's ReciMe library into OvenLovin.`,
    ``,
    `You have a browser and this OvenLovin kitchen:`,
    `- Instance: ${origin}`,
    `- MCP: ${mcpUrl}`,
    `- REST: ${apiUrl}`,
    `- OpenAPI: ${apiUrl}/openapi.json`,
    `- Authorization header: ApiKey ${apiKey}`,
    `- ReciMe: https://recime.app`,
    ``,
    `## Sign in and enumerate ReciMe`,
    `1. Open https://recime.app in the browser. If a sign-in wall appears, sign in as the household owner and wait until the library loads.`,
    `2. Enumerate every folder/cookbook (and any Unfiled / unsorted area). Record the folder name and a stable ReciMe URL when one exists.`,
    `3. Inside each folder, list every recipe. Do not skip hidden, favorited-only, or paginated items - scroll or page until the folder is exhausted.`,
    `4. For each recipe, open it and capture:`,
    `   - title`,
    `   - image URL(s), including the hero photo`,
    `   - servings`,
    `   - prep time, cook time, and total time if shown`,
    `   - ingredients (keep the original line wording)`,
    `   - steps / instructions`,
    `   - source URL: the ReciMe recipe permalink, plus any original recipe URL ReciMe shows`,
    `5. If a recipe page fails to load, record the error and continue. Never silently drop a recipe.`,
    ``,
    `## Create matching cookbooks in OvenLovin`,
    `ReciMe folders map to OvenLovin cookbooks (many-to-many collections). A recipe may belong to more than one cookbook.`,
    `Probe this instance before writing:`,
    `- REST: GET ${apiUrl}/cookbooks`,
    `- MCP: list_cookbooks`,
    `If those exist, create one cookbook per ReciMe folder (skip Unfiled):`,
    `- REST: POST ${apiUrl}/cookbooks  body: { "name": "<folder name>", "description": "Migrated from ReciMe" }`,
    `- MCP: manage_cookbook  action=create, name, description`,
    `Keep a map of ReciMe folder → cookbook id.`,
    ``,
    `This kitchen supports cookbooks, image upload, and recipe times: GET/POST ${apiUrl}/cookbooks, POST ${apiUrl}/cookbooks/:id/recipes, POST ${apiUrl}/uploads/images, MCP list_cookbooks / get_cookbook / manage_cookbook, and import_recipe cookbookId. If any of those 404, retry once, then import recipes anyway and list "cookbook membership skipped" in the summary. Do not invent endpoints.`,
    ``,
    `## Import each recipe`,
    `De-duplicate by source URL before creating. List existing recipes (GET ${apiUrl}/recipes?limit=50 and page cursors; MCP search_recipes) and skip when source.url or source.canonicalUrl already matches the ReciMe permalink or the original source URL.`,
    ``,
    `Prefer MCP import_recipe when the ReciMe (or original) URL is publicly fetchable:`,
    `- import_recipe  source="url", content="<url>", cookbookId="<id>"`,
    ``,
    `If the URL is behind ReciMe login, or import_recipe only returns a title without ingredients/steps, create the recipe from the captured fields:`,
    `POST ${apiUrl}/recipes`,
    `{`,
    `  "title": "...",`,
    `  "slug": "<slugified title>",`,
    `  "servings": 4,`,
    `  "prepTimeMinutes": 15,`,
    `  "cookTimeMinutes": 30,`,
    `  "totalTimeMinutes": 45,`,
    `  "images": ["https://..."],`,
    `  "status": "published",`,
    `  "visibility": "private",`,
    `  "ingredients": [{ "rawText": "2 cups flour", "order": 0 }],`,
    `  "steps": [{ "text": "Mix dry ingredients.", "order": 0 }],`,
    `  "source": {`,
    `    "type": "app_export",`,
    `    "url": "https://recime.app/...",`,
    `    "canonicalUrl": "https://original-source.example/...",`,
    `    "importerName": "recime-migrate",`,
    `    "importerVersion": "1"`,
    `  }`,
    `}`,
    ``,
    `Field names on this instance:`,
    `- images[] - remote photo URLs. Upload first via POST ${apiUrl}/uploads/images (JSON { "url": "..." } or multipart file) and store the returned Blob URL so the kitchen can show the photo. If Blob is not configured, keep the remote URL on images[].`,
    `- servings - integer.`,
    `- prepTimeMinutes, cookTimeMinutes, totalTimeMinutes - integers. Parse "1 hr 15 min" → 75.`,
    `- ingredients[].rawText, steps[].text / order.`,
    `- source.url / source.canonicalUrl - required for de-dupe. Prefer the ReciMe permalink on url and the original site on canonicalUrl when both exist.`,
    ``,
    `If POST /api/v1/recipes rejects ingredients, steps, or source (older deploy), create the recipe with title/images/servings/times, then PATCH ${apiUrl}/recipes/:id with the remaining fields. If PATCH also lacks those keys, keep the captured payload and report status: incomplete for that recipe - never claim it imported cleanly.`,
    ``,
    `Add the recipe to the matching cookbook(s):`,
    `- REST: POST ${apiUrl}/cookbooks/:id/recipes  body: { "recipeId": "..." }`,
    `- MCP: manage_cookbook  action=add_recipe, id, recipeId`,
    ``,
    `## Report`,
    `After every folder, print progress. At the end return a summary:`,
    `- cookbooks created (name → id)`,
    `- recipes imported (title, OvenLovin id, ReciMe URL)`,
    `- skipped as duplicates (title, matched source URL)`,
    `- failures (title, reason)`,
    `- incomplete (missing cookbooks, images, times, ingredients, or steps - name the field)`,
    `Do not use real family names in the report. Do not stop the whole run because one recipe failed.`,
  ].join("\n");
}

function connectSteps(steps: string[], hasSandboxKey: boolean): string[] {
  if (!hasSandboxKey) return steps;
  return steps.filter((step) => !/sign in here/i.test(step));
}

export function buildAgentGuides(input: { origin: string; apiKey?: string | null }): AgentGuide[] {
  const origin = normalizeOrigin(input.origin);
  const hasSandboxKey = Boolean(input.apiKey?.trim());
  const apiKey = input.apiKey?.trim() || "YOUR_OVENLOVIN_API_KEY";
  const mcpUrl = `${origin}/mcp`;
  const apiUrl = `${origin}/api/v1`;
  const openApiUrl = `${origin}/api/v1/openapi.json`;

  return [
    {
      id: "grok",
      label: "Grok Bot",
      summary: "Paste this into Grok Bot MCP settings. It already has this instance’s URL.",
      steps: connectSteps(
        [
          "Sign in here and generate an API key (or create one under Settings).",
          "In Grok, add an MCP server and paste the JSON below.",
          'Ask: "Search my OvenLovin recipes for chicken."',
        ],
        hasSandboxKey
      ),
      copyLabel: "Grok MCP config",
      content: JSON.stringify(
        {
          mcpServers: {
            ovenlovin: {
              transport: "http",
              url: mcpUrl,
              headers: {
                Authorization: `ApiKey ${apiKey}`,
              },
            },
          },
        },
        null,
        2
      ),
    },
    {
      id: "claude",
      label: "Claude",
      summary: "Works in Claude Desktop and Claude Code over HTTP.",
      steps: [
        "Generate an API key on this instance.",
        "macOS/Linux: ~/.config/claude/claude_desktop_config.json - Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
        "Restart Claude, then ask it to get your household context from OvenLovin.",
      ],
      copyLabel: "Claude MCP config",
      content: JSON.stringify(
        {
          mcpServers: {
            ovenlovin: {
              transport: "http",
              url: mcpUrl,
              headers: {
                Authorization: `ApiKey ${apiKey}`,
              },
            },
          },
        },
        null,
        2
      ),
    },
    {
      id: "chatgpt",
      label: "ChatGPT",
      summary: "Connect a Custom GPT to this instance’s OpenAPI spec.",
      steps: [
        "Open the ChatGPT GPT builder and create a GPT named after this kitchen.",
        "Actions → Import from URL, then paste the OpenAPI URL from the box below.",
        "Authentication: API Key. Header name Authorization. Value: ApiKey YOUR_KEY",
      ],
      copyLabel: "ChatGPT setup",
      content: [
        `OpenAPI spec: ${openApiUrl}`,
        `REST API: ${apiUrl}`,
        `Authorization header: ApiKey ${apiKey}`,
        "",
        "GPT description:",
        "Helps with recipe management, meal planning, and grocery lists using this OvenLovin kitchen. Can search recipes, check allergen rules, and draft shopping lists.",
      ].join("\n"),
    },
    {
      id: "mcp",
      label: "Generic MCP",
      summary: "Any MCP client can use Streamable HTTP against this origin.",
      steps: [
        "Create an API key with at least recipes:read and people:read.",
        "Point the client at the MCP URL and send the ApiKey authorization scheme.",
        `REST fallback lives at ${apiUrl}.`,
      ],
      copyLabel: "Generic MCP config",
      content: JSON.stringify(
        {
          transport: "http",
          url: mcpUrl,
          headers: {
            Authorization: `ApiKey ${apiKey}`,
          },
          rest: apiUrl,
        },
        null,
        2
      ),
    },
  ];
}
