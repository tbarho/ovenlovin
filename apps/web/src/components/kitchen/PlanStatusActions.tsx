"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";

export function PlanStatusActions({ planId, status }: { planId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const final = status === "approved";

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/meal-plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: final ? "draft" : "approved" }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
      setPending(false);
    }
  }

  return (
    <>
      <button className="btn" type="button" disabled={pending} onClick={() => void toggle()}>
        {pending ? "Saving…" : final ? "Reopen as draft" : "Mark as final"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </>
  );
}
