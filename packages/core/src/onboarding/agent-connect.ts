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

export function buildAgentGuides(input: { origin: string; apiKey?: string | null }): AgentGuide[] {
  const origin = normalizeOrigin(input.origin);
  const apiKey = input.apiKey?.trim() || "YOUR_OVENLOVIN_API_KEY";
  const mcpUrl = `${origin}/mcp`;
  const apiUrl = `${origin}/api/v1`;
  const openApiUrl = `${origin}/api/v1/openapi.json`;

  return [
    {
      id: "grok",
      label: "Grok Bot",
      summary: "Paste this into Grok Bot MCP settings. It already has this instance’s URL.",
      steps: [
        "Sign in here and generate an API key (or create one under Settings).",
        "In Grok, add an MCP server and paste the JSON below.",
        'Ask: "Search my OvenLovin recipes for chicken."',
      ],
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
        "macOS/Linux: ~/.config/claude/claude_desktop_config.json — Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
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
