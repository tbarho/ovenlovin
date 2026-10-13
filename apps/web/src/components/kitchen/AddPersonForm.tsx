"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Person } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";

export function AddPersonForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const person = await api<Person>("/api/v1/people", {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });
      router.push(`/people/${person.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add person");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={onSubmit}>
      <h2>Add a person</h2>
      <input
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
        placeholder="Parent A"
        required
      />
      {error ? <p className="muted">{error}</p> : null}
      <button className="btn primary" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}
