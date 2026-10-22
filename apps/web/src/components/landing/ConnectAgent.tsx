"use client";

import { useEffect, useMemo, useState } from "react";
import { buildAgentGuides, type AgentGuideId } from "@ovenlovin/core/onboarding";
import { CopyBox } from "./CopyBox";
import { OverflowX } from "./OverflowX";

const TABS: AgentGuideId[] = ["grok", "claude", "chatgpt", "mcp"];

export function ConnectAgent({ origin, apiKey }: { origin: string; apiKey?: string | null }) {
  const [liveOrigin, setLiveOrigin] = useState(origin);
  const [active, setActive] = useState<AgentGuideId>("grok");

  useEffect(() => {
    setLiveOrigin(window.location.origin);
  }, []);

  const guides = useMemo(
    () => buildAgentGuides({ origin: liveOrigin, apiKey }),
    [liveOrigin, apiKey]
  );
  const guide = guides.find((item) => item.id === active) ?? guides[0];

  if (!guide) return null;

  return (
    <div className="agent">
      <OverflowX className="tabs-fade">
        <div className="tabs" data-scroll role="tablist" aria-label="Connect your agent">
          {TABS.map((id) => {
            const item = guides.find((guideItem) => guideItem.id === id);
            return (
              <button
                key={id}
                type="button"
                className="tab"
                role="tab"
                aria-selected={active === id}
                onClick={() => setActive(id)}
              >
                {item?.label ?? id}
              </button>
            );
          })}
        </div>
      </OverflowX>
      <div className="guide">
        <div>
          <p className="intro">{guide.summary}</p>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <CopyBox
          label={guide.copyLabel}
          content={guide.content}
          secret={Boolean(apiKey?.trim())}
          secretValue={apiKey?.trim() || undefined}
        />
      </div>
    </div>
  );
}
