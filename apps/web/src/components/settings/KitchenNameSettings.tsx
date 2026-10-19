"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/browser-api";

type HouseholdName = {
  name: string;
};

export function KitchenNameSettings({ canRename }: { canRename: boolean }) {
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const data = await api<HouseholdName>("/api/v1/households");
    setName(data.name);
    setDraft(data.name);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load the kitchen name");
    });
  }, [load]);

  async function save() {
    const next = draft.trim();
    if (!next || next === name) return;
    setPending(true);
    setError(null);
    try {
      const data = await api<HouseholdName>("/api/v1/households", {
        method: "PATCH",
        body: JSON.stringify({ name: next }),
      });
      setName(data.name);
      setDraft(data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename this kitchen");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className="kitchen-panel kitchen-name-settings"
      aria-labelledby="kitchen-name-heading"
      data-testid="kitchen-name-settings"
    >
      <h2 id="kitchen-name-heading">Kitchen name</h2>
      <p className="muted">
        {canRename
          ? "Shown in the kitchen switcher when you belong to more than one kitchen."
          : "Ask an owner if this kitchen needs a different name."}
      </p>
      {canRename ? (
        <form
          className="kitchen-name-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label>
            <span>Name</span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={255}
              disabled={pending}
              autoComplete="off"
            />
          </label>
          <button
            className="btn"
            type="submit"
            disabled={pending || draft.trim() === name || draft.trim().length === 0}
          >
            {pending ? "Saving…" : "Save name"}
          </button>
        </form>
      ) : (
        <p>{name || "This kitchen"}</p>
      )}
      {error ? <p className="muted">{error}</p> : null}
    </section>
  );
}
