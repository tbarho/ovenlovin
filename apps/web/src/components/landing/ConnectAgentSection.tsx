"use client";

import { useState } from "react";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { ConnectAgent } from "./ConnectAgent";
import { RecimeMigrateSection } from "./RecimeMigrateSection";

export function ConnectAgentSection({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  return (
    <>
      <section className="section" id="connect">
        <div className="wrap">
          <h2>Connect your agent</h2>
          <p className="intro">
            These snippets already use this origin ({origin}). Sign in to generate an API key, then
            paste.
          </p>
          {signedIn ? (
            <ApiKeyManager onCreated={setApiKey} />
          ) : (
            <p className="empty-note">
              Sign in to create and manage API keys. Until then the snippets use
              YOUR_OVENLOVIN_API_KEY.
            </p>
          )}
          <ConnectAgent origin={origin} apiKey={apiKey} />
        </div>
      </section>
      <section className="section" id="migrate">
        <div className="wrap">
          <h2>Migrate from ReciMe</h2>
          <p className="intro">
            Bring every ReciMe folder into this kitchen. Copy the prompt, hand it to an agent with a
            browser, and it will create matching cookbooks and import each recipe.
          </p>
          <RecimeMigrateSection origin={origin} apiKey={apiKey} />
        </div>
      </section>
    </>
  );
}
