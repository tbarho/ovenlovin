export const MCP_SAMPLE = `{
  "mcpServers": {
    "ovenlovin": {
      "url": "https://your-app.vercel.app/mcp",
      "headers": {
        "Authorization": "ApiKey YOUR_OVENLOVIN_API_KEY"
      }
    }
  }
}`;

export const REST_SAMPLE = `const res = await fetch("https://your-app.vercel.app/api/v1/recipes", {
  method: "POST",
  headers: {
    Authorization: "ApiKey YOUR_OVENLOVIN_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "Chocolate Chip Cookies",
    servings: 24,
    ingredients: [{ rawText: "2 cups flour" }],
  }),
});

const check = await fetch(\`https://your-app.vercel.app/api/v1/meal-plans/\${id}/check\`, {
  method: "POST",
  headers: {
    Authorization: "ApiKey YOUR_OVENLOVIN_API_KEY",
  },
});
// per-person block / warn / prefer-avoid findings`;
