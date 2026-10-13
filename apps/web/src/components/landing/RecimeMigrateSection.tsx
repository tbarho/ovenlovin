"use client";

import { useEffect, useMemo, useState } from "react";
import { buildRecimeMigratePrompt } from "@ovenlovin/core/onboarding";
import { CopyBox } from "./CopyBox";

export function RecimeMigrateSection({
  origin,
  apiKey,
}: {
  origin: string;
  apiKey?: string | null;
}) {
  const [liveOrigin, setLiveOrigin] = useState(origin);

  useEffect(() => {
    setLiveOrigin(window.location.origin);
  }, []);

  const prompt = useMemo(
    () => buildRecimeMigratePrompt({ origin: liveOrigin, apiKey }),
    [liveOrigin, apiKey]
  );

  return (
    <div className="guide recime-guide">
      <div>
        <p className="intro">
          For an agent with a browser plus this kitchen&apos;s MCP or API key. It signs into ReciMe,
          walks every folder, and imports matching cookbooks and recipes here — images, servings,
          times, and source URLs included.
        </p>
        <ol>
          <li>Generate an API key above, or leave the placeholder and paste a key later.</li>
          <li>Copy the prompt. The instance URL is already filled in ({liveOrigin}).</li>
          <li>Give the agent browser access and this kitchen&apos;s MCP connection or API key.</li>
          <li>
            Cookbooks, images, and times are on this instance. If an endpoint 404s, the prompt tells
            the agent to retry once, then continue and mark those items incomplete.
          </li>
        </ol>
      </div>
      <CopyBox label="Migrate from ReciMe" content={prompt} />
    </div>
  );
}
