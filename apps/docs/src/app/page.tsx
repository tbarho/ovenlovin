import Link from "next/link";
import { BookOpen, Code, Zap, Shield, Users, Bot } from "lucide-react";

export default function HomePage(): React.ReactElement {
  return (
    <main className="container max-w-6xl py-12 sm:py-24">
      <div className="flex flex-col items-center text-center gap-6 mb-16">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          <span className="text-primary">OvenLovin</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          LLM-optimized recipe and family meal-planning platform. Built for AI agents to help
          families manage weekly meal planning with per-person dietary rules and allergy checking.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <a
            href="https://vercel.com/new/clone?repository-url=https://github.com/tbarho/ovenlovin&root-directory=apps/web&env=DATABASE_URL,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,CLERK_SECRET_KEY,BLOB_READ_WRITE_TOKEN,AI_GATEWAY_API_KEY,USDA_FDC_API_KEY&envDescription=Required%20API%20keys%20and%20connection%20strings%20for%20OvenLovin&envLink=https://tbarho.github.io/ovenlovin/docs/self-hosting&project-name=ovenlovin&repository-name=ovenlovin&demo-title=OvenLovin&demo-description=AI-powered%20family%20meal%20planning%20platform"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5 mr-2"
              viewBox="0 0 76 76"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
            Deploy to Vercel
          </a>
          <Link
            href="/docs"
            className="px-6 py-3 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Read Documentation
          </Link>
          <a
            href="https://github.com/tbarho/ovenlovin"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        <FeatureCard
          icon={<Bot className="w-6 h-6" />}
          title="Agent-First Design"
          description="REST API, MCP server, and CLI built for Grok Bot, ChatGPT, and Claude Desktop"
        />
        <FeatureCard
          icon={<Shield className="w-6 h-6" />}
          title="Safety-Critical Rules"
          description="Per-person allergy and dietary restrictions with deterministic checking"
        />
        <FeatureCard
          icon={<Users className="w-6 h-6" />}
          title="Multi-Household"
          description="Clerk auth with organizations for family account management"
        />
        <FeatureCard
          icon={<BookOpen className="w-6 h-6" />}
          title="Recipe Import"
          description="Import from URLs, photos with OCR, voice input, or app exports"
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6" />}
          title="Meal Planning"
          description="AI-powered weekly meal plans with rule checking and shopping lists"
        />
        <FeatureCard
          icon={<Code className="w-6 h-6" />}
          title="Developer-Friendly"
          description="Zod schemas, OpenAPI spec, TypeScript SDK, and comprehensive docs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        <div className="border border-border rounded-lg p-8 bg-card">
          <h2 className="text-2xl font-bold mb-4">MCP Tool Example</h2>
          <p className="text-muted-foreground mb-4">
            Connect your AI agent to OvenLovin with the Model Context Protocol:
          </p>
          <div className="bg-background border border-border rounded-md p-4 font-mono text-sm overflow-x-auto">
            <pre>
              {`{
  "mcpServers": {
    "ovenlovin": {
      "url": "https://ovenlovin.dev/mcp",
      "apiKey": "your-api-key"
    }
  }
}`}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Then use tools like <code className="bg-muted px-1 py-0.5 rounded">import_recipe</code>,{" "}
            <code className="bg-muted px-1 py-0.5 rounded">check_meal_plan</code>, and{" "}
            <code className="bg-muted px-1 py-0.5 rounded">export_shopping_list</code>
          </p>
        </div>

        <div className="border border-border rounded-lg p-8 bg-card">
          <h2 className="text-2xl font-bold mb-4">REST API Example</h2>
          <p className="text-muted-foreground mb-4">
            Use the OpenAPI-compliant REST API from any HTTP client:
          </p>
          <div className="bg-background border border-border rounded-md p-4 font-mono text-sm overflow-x-auto">
            <pre>
              {`POST /api/v1/recipes
{
  "title": "Chocolate Chip Cookies",
  "servings": 24,
  "ingredients": [...],
  "steps": [...]
}

GET /api/v1/meal-plans/:id/check
Returns rule violations for attendees`}
            </pre>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Full OpenAPI spec at{" "}
            <code className="bg-muted px-1 py-0.5 rounded">/api/v1/openapi.json</code>
          </p>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="border border-border rounded-lg p-6 hover:border-primary/50 transition-colors">
      <div className="text-primary mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
