"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/browser-api";

export function AddRuleForm({ personId }: { personId: string }) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState("allergen");
  const [severity, setSeverity] = useState("block");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/people/${personId}/rules`, {
        method: "POST",
        body: JSON.stringify({ kind, target, severity }),
      });
      setTarget("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add rule");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h2>Add a rule</h2>
      <select value={kind} onChange={(event) => setKind(event.target.value)}>
        <option value="allergen">Allergen</option>
        <option value="ingredient">Ingredient</option>
        <option value="diet">Diet</option>
        <option value="custom">Custom</option>
      </select>
      <input
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        placeholder="peanut"
        required
      />
      <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
        <option value="block">Block</option>
        <option value="warn">Warn</option>
        <option value="prefer_avoid">Prefer avoid</option>
      </select>
      {error ? <p className="muted">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save rule"}
      </button>
    </form>
  );
}
