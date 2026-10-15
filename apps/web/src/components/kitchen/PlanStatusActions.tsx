"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";
import { planFinalConfirmCopy, type PlanBlockNight } from "@/lib/plan-final";
import { ConfirmDialog } from "./ConfirmDialog";

export function PlanStatusActions({
  planId,
  status,
  needsRecheck = false,
  blockNights = [],
}: {
  planId: string;
  status: string;
  needsRecheck?: boolean;
  blockNights?: PlanBlockNight[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const final = status === "approved";
  const confirm = planFinalConfirmCopy({ needsRecheck, blockNights });

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/meal-plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: final ? "draft" : "approved" }),
      });
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
    } finally {
      setPending(false);
    }
  }

  function onMarkClick() {
    if (!final && confirm.needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    void toggle();
  }

  return (
    <>
      <button className="btn" type="button" disabled={pending} onClick={onMarkClick}>
        {pending ? "Saving…" : final ? "Reopen as draft" : "Mark as final"}
      </button>
      {error ? <p className="muted">{error}</p> : null}
      <ConfirmDialog
        open={confirmOpen}
        title={confirm.title}
        body={confirm.body}
        confirmLabel="Mark as final anyway"
        pending={pending}
        danger
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void toggle()}
      />
    </>
  );
}
