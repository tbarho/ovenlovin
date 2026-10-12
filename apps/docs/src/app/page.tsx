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
        <div className="flex gap-4 mt-4">
          <Link
            href="/docs"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <a
            href="https://github.com/tbarho/ovenlovin"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            GitHub
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

      <div className="border border-border rounded-lg p-8 bg-card">
        <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
        <p className="text-muted-foreground mb-4">Deploy to Vercel in one click or run locally:</p>
        <div className="bg-background border border-border rounded-md p-4 font-mono text-sm">
          <div className="text-muted-foreground mb-2"># Clone the repository</div>
          <div>git clone https://github.com/tbarho/ovenlovin.git</div>
          <div className="text-muted-foreground mb-2 mt-4"># Install dependencies</div>
          <div>pnpm install</div>
          <div className="text-muted-foreground mb-2 mt-4"># Run development server</div>
          <div>pnpm dev</div>
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
