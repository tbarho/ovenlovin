"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/browser-api";
import { CopyBox } from "@/components/landing/CopyBox";

export type PublicApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type CreatedKey = PublicApiKey & { plaintext: string };

function formatWhen(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function maskPrefix(prefix: string): string {
  return `${prefix}••••`;
}

export function ApiKeyManager({ onCreated }: { onCreated?: (plaintext: string) => void }) {
  const [keys, setKeys] = useState<PublicApiKey[]>([]);
  const [name, setName] = useState("Agent key");
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    const data = await api<{ items: PublicApiKey[] }>("/api/v1/api-keys");
    setKeys(data.items);
  }, []);

  useEffect(() => {
    loadKeys().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load API keys");
    });
  }, [loadKeys]);

  async function createKey() {
    setPending(true);
    setError(null);
    try {
      const created = await api<CreatedKey>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() || "Agent key" }),
      });
      setPlaintext(created.plaintext);
      onCreated?.(created.plaintext);
      setName("Agent key");
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate an API key");
    } finally {
      setPending(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm("Revoke this key? Agents using it will stop working.")) return;
    setRevokingId(id);
    setError(null);
    try {
      await api(`/api/v1/api-keys/${id}`, { method: "DELETE" });
      await loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke this API key");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="key-manager">
      <div className="auth-card">
        <p>
          Create a named key for each bot. The secret is shown once at creation. Existing keys show
          a masked prefix, when they were created, and when they were last used.
        </p>
        <div className="key-create">
          <label>
            <span className="sr-only">Key name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Key name"
              maxLength={255}
            />
          </label>
          <button className="btn primary" type="button" onClick={createKey} disabled={pending}>
            {pending ? "Creating…" : "Create API key"}
          </button>
        </div>
        {error ? <p className="muted">{error}</p> : null}
      </div>

      {plaintext ? (
        <div className="key-secret">
          <p>Copy this secret now. It will not be shown again.</p>
          <CopyBox label="New API key" content={plaintext} secret />
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="empty-note">No API keys yet. Create one for Grok, Claude, or ChatGPT.</p>
      ) : (
        <div className="key-table-wrap">
          <table className="key-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Key</th>
                <th>Created</th>
                <th>Last used</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => {
                const revoked = Boolean(key.revokedAt);
                return (
                  <tr key={key.id} className={revoked ? "is-revoked" : undefined}>
                    <td>{key.name}</td>
                    <td>
                      <code>{maskPrefix(key.keyPrefix)}</code>
                    </td>
                    <td>{formatWhen(key.createdAt)}</td>
                    <td>{formatWhen(key.lastUsedAt)}</td>
                    <td>{revoked ? "Revoked" : "Active"}</td>
                    <td>
                      {revoked ? null : (
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => revokeKey(key.id)}
                          disabled={revokingId === key.id}
                        >
                          {revokingId === key.id ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
