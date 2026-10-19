"use client";

import { useCallback, useEffect, useState } from "react";
import { CopyBox } from "@/components/landing/CopyBox";
import { api } from "@/lib/browser-api";

type Invite = {
  id: string;
  token: string;
  url?: string;
  role: "admin" | "member" | "viewer";
  expiresAt: string;
  createdAt: string;
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export function KitchenInvites({ canManage }: { canManage: boolean }) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [role, setRole] = useState<Invite["role"]>("member");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManage) return;
    const data = await api<{ items: Invite[] }>("/api/v1/households/invites");
    setInvites(data.items);
  }, [canManage]);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load invites");
    });
  }, [load]);

  if (!canManage) return null;

  async function createInvite() {
    setPending(true);
    setError(null);
    try {
      const created = await api<Invite>("/api/v1/households/invites", {
        method: "POST",
        body: JSON.stringify({ role, expiresInDays }),
      });
      setCreatedUrl(created.url ?? "");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create an invite");
    } finally {
      setPending(false);
    }
  }

  async function revokeInvite(id: string) {
    if (!window.confirm("Revoke this invite link?")) return;
    setRevokingId(id);
    setError(null);
    try {
      await api(`/api/v1/households/invites/${id}`, { method: "DELETE" });
      setInvites((current) => current.filter((invite) => invite.id !== id));
      setCreatedUrl(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke this invite");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section className="kitchen-panel" aria-labelledby="kitchen-invites-heading">
      <h2 id="kitchen-invites-heading">Invite links</h2>
      <p className="muted">
        Share a link so a spouse or family member can join this kitchen. OvenLovin does not send
        email.
      </p>
      <div className="invite-create">
        <label>
          <span>Role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as Invite["role"])}>
            <option value="member">member</option>
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <label>
          <span>Expires in days</span>
          <input
            type="number"
            min={1}
            max={30}
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value) || 7)}
          />
        </label>
        <button
          className="btn primary"
          type="button"
          onClick={() => void createInvite()}
          disabled={pending}
        >
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {createdUrl ? (
        <div className="key-secret">
          <p>Copy this link and send it yourself.</p>
          <CopyBox label="Invite link" content={createdUrl} />
        </div>
      ) : null}
      {invites.length === 0 ? (
        <p className="empty-note">No pending invite links.</p>
      ) : (
        <ul className="invite-list">
          {invites.map((invite) => (
            <li key={invite.id} className="invite-row">
              <div>
                <strong>{invite.role}</strong>
                <p className="muted">Expires {formatWhen(invite.expiresAt)}</p>
                {invite.url ? <CopyBox label="Invite link" content={invite.url} /> : null}
              </div>
              <button
                className="btn ghost"
                type="button"
                disabled={revokingId === invite.id}
                onClick={() => void revokeInvite(invite.id)}
              >
                {revokingId === invite.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
