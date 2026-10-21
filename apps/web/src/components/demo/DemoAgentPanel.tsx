"use client";

import { ConnectAgent } from "@/components/landing/ConnectAgent";
import { CopyBox } from "@/components/landing/CopyBox";

export function DemoAgentPanel({ origin, apiKey }: { origin: string; apiKey: string }) {
  const mcpUrl = `${origin.replace(/\/$/, "")}/mcp`;

  return (
    <div className="demo-agent">
      <h2>Connect Claude or Grok</h2>
      <p className="muted">
        This sandbox has its own MCP URL and API key. Paste both into an agent in about a minute.
        Resetting the kitchen keeps this key; it points at the new seed data.
      </p>
      <CopyBox label="MCP URL" content={mcpUrl} />
      <CopyBox label="Sandbox API key" content={apiKey} secret />
      <p className="muted">
        Authorization header: <code>ApiKey</code> plus the sandbox key above.
      </p>
      <ConnectAgent origin={origin} apiKey={apiKey} />
    </div>
  );
}
