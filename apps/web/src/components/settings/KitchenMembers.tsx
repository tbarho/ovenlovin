"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/kitchen/ConfirmDialog";
import { Badge, Button, Hint, Select } from "@/components/ui";
import { api } from "@/lib/browser-api";
import { useVisibleRefresh } from "@/lib/use-visible-refresh";

export type KitchenMember = {
  membershipId: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  createdAt: string;
};

const ROLES: KitchenMember["role"][] = ["owner", "admin", "member", "viewer"];

const ROLE_LABELS: Record<KitchenMember["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

type MemberConfirm = { kind: "remove"; userId: string; label: string } | { kind: "leave" } | null;

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
  const [confirm, setConfirm] = useState<MemberConfirm>(null);

  const load = useCallback(async () => {
    const data = await api<{ items: KitchenMember[] }>("/api/v1/households/members");
    setMembers(data.items);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load kitchen members");
    });
  }, [load]);

  useVisibleRefresh(load);

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

  async function removeMember() {
    if (confirm?.kind !== "remove") return;
    const { userId } = confirm;
    setPendingId(userId);
    setError(null);
    try {
      await api(`/api/v1/households/members/${userId}`, { method: "DELETE" });
      setConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that member");
    } finally {
      setPendingId(null);
    }
  }

  async function leaveKitchen() {
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
      {error ? <Hint tone="error">{error}</Hint> : null}
      {members.length === 0 ? (
        <p className="empty-note">No members loaded yet.</p>
      ) : (
        <ul className="member-list">
          {members.map((member) => {
            const name = member.displayName?.trim();
            const nameClash =
              Boolean(name) &&
              members.filter((item) => item.displayName?.trim() === name).length > 1;
            const label = nameClash || !name ? member.email : name;
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
                      <Select
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
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : (
                    <Badge variant="neutral">{ROLE_LABELS[member.role]}</Badge>
                  )}
                  {canManage && !isSelf ? (
                    <Button
                      variant="tertiary"
                      type="button"
                      loading={pendingId === member.userId}
                      disabled={pendingId === member.userId}
                      onClick={() => setConfirm({ kind: "remove", userId: member.userId, label })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {canLeave ? (
        <Button
          variant="tertiary"
          type="button"
          loading={leaving}
          disabled={leaving}
          onClick={() => setConfirm({ kind: "leave" })}
        >
          Leave This Kitchen
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        title="Remove member?"
        body={
          confirm?.kind === "remove"
            ? `Remove ${confirm.label} from this kitchen?`
            : "Remove this person from this kitchen?"
        }
        confirmLabel="Remove"
        danger
        pending={Boolean(pendingId)}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void removeMember()}
      />
      <ConfirmDialog
        open={confirm?.kind === "leave"}
        title="Leave kitchen?"
        body="You will lose access to its recipes."
        confirmLabel="Leave"
        danger
        pending={leaving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void leaveKitchen()}
      />
    </section>
  );
}
