"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/browser-api";

export type KitchenMember = {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
};

const ROLES: KitchenMember["role"][] = ["owner", "admin", "member", "viewer"];

export function KitchenMembers({
  currentUserId,
  currentRole,
}: {
  currentUserId?: string;
  currentRole?: KitchenMember["role"];
}) {
  const [members, setMembers] = useState<KitchenMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    const data = await api<{ items: KitchenMember[] }>("/api/v1/households/members");
    setMembers(data.items);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load kitchen members");
    });
  }, [load]);

  const owners = members.filter((member) => member.role === "owner");
  const canManage = currentRole === "owner";
  const self = members.find((member) => member.userId === currentUserId);
  const canLeave = Boolean(self) && !(self?.role === "owner" && owners.length === 1);

  async function changeRole(userId: string, role: KitchenMember["role"]) {
    setPendingId(userId);
    setError(null);
    try {
      await api(`/api/v1/households/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change that role");
    } finally {
      setPendingId(null);
    }
  }

  async function removeMember(userId: string, label: string) {
    if (!window.confirm(`Remove ${label} from this kitchen?`)) return;
    setPendingId(userId);
    setError(null);
    try {
      await api(`/api/v1/households/members/${userId}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that member");
    } finally {
      setPendingId(null);
    }
  }

  async function leaveKitchen() {
    if (!window.confirm("Leave this kitchen? You will lose access to its recipes.")) return;
    setLeaving(true);
    setError(null);
    try {
      const result = await api<{ activeHouseholdId: string | null }>("/api/v1/households/leave", {
        method: "POST",
      });
      window.location.assign(result.activeHouseholdId ? "/recipes" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave this kitchen");
      setLeaving(false);
    }
  }

  return (
    <section className="kitchen-panel" aria-labelledby="kitchen-members-heading">
      <h2 id="kitchen-members-heading">Kitchen members</h2>
      <p className="muted">
        Signed-in people who share this kitchen. People on the People tab are dietary profiles, not
        accounts.
      </p>
      {error ? <p className="muted">{error}</p> : null}
      {members.length === 0 ? (
        <p className="empty-note">No members loaded yet.</p>
      ) : (
        <ul className="member-list">
          {members.map((member) => {
            const label = member.displayName?.trim() || member.email;
            const isSelf = member.userId === currentUserId;
            return (
              <li key={member.membershipId} className="member-row">
                <div className="member-identity">
                  <strong>{label}</strong>
                  <p className="muted">
                    {member.email}
                    {isSelf ? " (you)" : ""}
                  </p>
                </div>
                <div className="member-actions">
                  {canManage ? (
                    <label>
                      <span className="sr-only">Role for {label}</span>
                      <select
                        value={member.role}
                        disabled={pendingId === member.userId}
                        onChange={(event) =>
                          void changeRole(
                            member.userId,
                            event.target.value as KitchenMember["role"]
                          )
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <span className="member-role">{member.role}</span>
                  )}
                  {canManage && !isSelf ? (
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={pendingId === member.userId}
                      onClick={() => void removeMember(member.userId, label)}
                    >
                      {pendingId === member.userId ? "Removing…" : "Remove"}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canLeave ? (
        <button
          className="btn ghost"
          type="button"
          disabled={leaving}
          onClick={() => void leaveKitchen()}
        >
          {leaving ? "Leaving…" : "Leave this kitchen"}
        </button>
      ) : null}
    </section>
  );
}
