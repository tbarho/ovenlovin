"use client";

import { useState } from "react";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { ConnectAgent } from "./ConnectAgent";

export function ConnectAgentSection({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  const [apiKey, setApiKey] = useState<string | null>(null);

  return (
    <>
      {signedIn ? (
        <ApiKeyManager onCreated={setApiKey} />
      ) : (
        <p className="empty-note">
          Sign in to create and manage API keys. Until then the snippets use YOUR_OVENLOVIN_API_KEY.
        </p>
      )}
      <ConnectAgent origin={origin} apiKey={apiKey} />
    </>
  );
}
