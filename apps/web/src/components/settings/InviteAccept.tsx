"use client";

import { useState } from "react";
import { Button, Hint } from "@/components/ui";
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
      <Button type="button" loading={pending} disabled={pending} onClick={() => void accept()}>
        Join {householdName}
      </Button>
      {error ? <Hint tone="error">{error}</Hint> : null}
    </div>
  );
}
