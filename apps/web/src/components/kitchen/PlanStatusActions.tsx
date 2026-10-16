"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";
import { planFinalConfirmCopy, type PlanBlockNight } from "@/lib/plan-final";
import { ConfirmDialog } from "./ConfirmDialog";
import { KitchenToast } from "./KitchenToast";

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
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const shownStatus = optimisticStatus ?? status;
  const final = shownStatus === "approved";
  const confirm = planFinalConfirmCopy({ needsRecheck, blockNights });

  async function toggle() {
    setPending(true);
    setError(null);
    const nextStatus = final ? "draft" : "approved";
    try {
      await api(`/api/v1/meal-plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setOptimisticStatus(nextStatus);
      setConfirmOpen(false);
      setToast(nextStatus === "approved" ? "Plan marked as final." : "Plan reopened as a draft.");
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
      <KitchenToast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
