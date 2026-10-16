"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";
import { recheckBannerDetail, type PlanBlockNight } from "@/lib/plan-final";

export function RecheckBanner({
  planId,
  nights = [],
  blockNights = [],
}: {
  planId: string;
  nights?: string[];
  blockNights?: PlanBlockNight[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  async function recheck() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/meal-plans/${planId}/check`, { method: "POST" });
      setCleared(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not recheck the plan");
    } finally {
      setPending(false);
    }
  }

  if (cleared) return null;

  const detail = recheckBannerDetail({ nights, blockNights });

  return (
    <div className="week-recheck" role="status">
      <p>This plan needs a recheck. {detail}</p>
      <button
        type="button"
        className="btn compact"
        disabled={pending}
        onClick={() => void recheck()}
      >
        {pending ? "Rechecking…" : "Recheck now"}
      </button>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
