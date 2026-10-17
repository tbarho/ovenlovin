"use client";

import { useState } from "react";
import { api } from "@/lib/browser-api";

export function InviteAccept({ token, householdName }: { token: string; householdName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/invites/${token}/accept`, { method: "POST" });
      window.location.assign("/recipes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this kitchen");
      setPending(false);
    }
  }

  return (
    <div className="invite-accept">
      <button
        className="btn primary"
        type="button"
        disabled={pending}
        onClick={() => void accept()}
      >
        {pending ? "Joining…" : `Join ${householdName}`}
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
