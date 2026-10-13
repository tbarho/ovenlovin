"use client";

import { useState } from "react";
import { api } from "@/lib/browser-api";
import { ConnectAgent } from "./ConnectAgent";

type CreatedKey = { plaintext: string };

export function ConnectAgentSection({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function generateKey() {
    setPending(true);
    setError(null);
    try {
      const created = await api<CreatedKey>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Agent key" }),
      });
      setApiKey(created.plaintext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate an API key");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {signedIn ? (
        <div className="auth-card">
          <p>
            Generate an API key for this kitchen, then copy the config. The plaintext key is shown
            once.
          </p>
          <button className="btn primary" type="button" onClick={generateKey} disabled={pending}>
            {pending ? "Generating…" : apiKey ? "Generate another key" : "Generate API key"}
          </button>
          {apiKey ? <p className="muted">Key prefix applied in the boxes below.</p> : null}
          {error ? <p className="muted">{error}</p> : null}
        </div>
      ) : (
        <p className="empty-note">
          Sign in to generate an API key here. Until then the snippets use YOUR_OVENLOVIN_API_KEY.
        </p>
      )}
      <ConnectAgent origin={origin} apiKey={apiKey} />
    </>
  );
}
