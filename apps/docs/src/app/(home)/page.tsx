import { BrandWordmark } from "@/components/brand-wordmark";
import { CodeSample } from "@/components/code-sample";
import { VERCEL_DEPLOY_URL } from "@ovenlovin/brand";
import { BookOpen, Bot, Code, Shield, Users, Zap } from "lucide-react";
import Link from "next/link";

const DEPLOY_URL = VERCEL_DEPLOY_URL;

const MCP_SAMPLE = `{
  "mcpServers": {
    "ovenlovin": {
      "url": "https://ovenlovin.dev/mcp",
      "apiKey": "your-api-key"
    }
  }
}`;

const REST_SAMPLE = `const res = await fetch("/api/v1/recipes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Chocolate Chip Cookies",
    servings: 24,
    ingredients: [/* ... */],
  }),
});

const check = await fetch(\`/api/v1/meal-plans/\${id}/check\`);
// per-person block / warn / prefer-avoid findings`;

export default function HomePage(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="ol-hero-grid" aria-hidden />
        <div className="ol-hero-glow" aria-hidden />
        <div className="container relative z-10 flex max-w-5xl flex-col items-center px-4 py-20 text-center sm:py-28">
          <p className="mb-6 rounded-full border border-[var(--ol-border)] bg-background px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground">
            Agent-first meal planning
          </p>
          <h1>
            <BrandWordmark size="hero" />
          </h1>
          <div className="ol-hero-flourish mx-auto mt-5" aria-hidden />
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            LLM-optimized recipe and family meal-planning platform. Built for AI agents to help
            families manage weekly meal planning with per-person dietary rules and allergy checking.
          </p>
          <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <a
              href={DEPLOY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
            >
              <svg
                className="mr-2 size-4"
                viewBox="0 0 76 76"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              Deploy to Vercel
            </a>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center rounded-md border border-[var(--ol-border)] bg-background px-5 py-2.5 text-sm font-medium transition-colors hover:border-foreground/25 hover:bg-accent"
            >
              Read Documentation
            </Link>
            <a
              href="https://github.com/tbarho/ovenlovin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-[var(--ol-border)] px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="container max-w-6xl px-4 pb-8">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Bot className="size-5" />}
            title="Agent-First Design"
            description="REST API, MCP server, and CLI built for Grok Bot, ChatGPT, and Claude Desktop"
          />
          <FeatureCard
            icon={<Shield className="size-5" />}
            title="Safety-Critical Rules"
            description="Per-person allergy and dietary restrictions with deterministic checking"
          />
          <FeatureCard
            icon={<Users className="size-5" />}
            title="Multi-Household"
            description="Clerk auth with organizations for family account management"
          />
          <FeatureCard
            icon={<BookOpen className="size-5" />}
            title="Recipe Import"
            description="Import from URLs, photos with OCR, voice input, or app exports"
          />
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="Meal Planning"
            description="AI-powered weekly meal plans with rule checking and shopping lists"
          />
          <FeatureCard
            icon={<Code className="size-5" />}
            title="Developer-Friendly"
            description="Zod schemas, OpenAPI spec, TypeScript SDK, and comprehensive docs"
          />
        </div>
      </section>

      <section className="container max-w-6xl px-4 py-16">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--ol-border)] bg-background p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight">MCP Tool Example</h2>
            <p className="mb-5 mt-2 text-sm text-muted-foreground">
              Connect your AI agent to OvenLovin with the Model Context Protocol:
            </p>
            <CodeSample title="mcp.json" lang="json" code={MCP_SAMPLE} />
            <p className="mt-4 text-sm text-muted-foreground">
              Then use tools like <InlineCode>import_recipe</InlineCode>,{" "}
              <InlineCode>check_meal_plan</InlineCode>, and{" "}
              <InlineCode>export_shopping_list</InlineCode>
            </p>
          </div>

          <div className="rounded-xl border border-[var(--ol-border)] bg-background p-6 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight">REST API Example</h2>
            <p className="mb-5 mt-2 text-sm text-muted-foreground">
              Use the OpenAPI-compliant REST API from any HTTP client:
            </p>
            <CodeSample title="recipes.ts" lang="ts" code={REST_SAMPLE} />
            <p className="mt-4 text-sm text-muted-foreground">
              Full OpenAPI spec at <InlineCode>/api/v1/openapi.json</InlineCode>
            </p>
          </div>
        </div>
      </section>
    </div>
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
    <div className="group rounded-xl border border-[var(--ol-border)] bg-background p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_12px_40px_-16px_rgba(255,255,255,0.18)]">
      <div className="mb-3 text-foreground transition-transform duration-200 group-hover:scale-105">
        {icon}
      </div>
      <h3 className="mb-1.5 font-semibold tracking-tight">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <code className="rounded border border-[var(--ol-border)] bg-[var(--ol-code-bg)] px-1.5 py-0.5 font-mono text-[13px]">
      {children}
    </code>
  );
}
