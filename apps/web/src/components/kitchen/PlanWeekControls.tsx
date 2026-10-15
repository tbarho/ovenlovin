"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";
import { addDays } from "@/lib/week-plan-view";

export function PlanWeekControls({
  weekStart,
  planId,
  status,
}: {
  weekStart: string;
  planId: string | null;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);

  async function markFinal() {
    if (!planId) return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/meal-plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "approved" }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark the plan as final");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="week-controls">
      <div className="recipe-actions" style={{ margin: 0 }}>
        <Link className="btn" href={`/plans?week=${previous}`}>
          Previous week
        </Link>
        <Link className="btn" href={`/plans?week=${next}`}>
          Next week
        </Link>
        {planId && status === "draft" ? (
          <button
            type="button"
            className="btn primary"
            disabled={pending}
            onClick={() => void markFinal()}
          >
            Mark as final
          </button>
        ) : null}
        <Link className="btn" href="/list">
          Shopping list
        </Link>
      </div>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
