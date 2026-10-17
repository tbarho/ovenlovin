"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/browser-api";

type KitchenOption = {
  household: { id: string; name: string };
  membership: { role: string };
};

export function KitchenSwitcher() {
  const [kitchens, setKitchens] = useState<KitchenOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ items: KitchenOption[]; activeHouseholdId: string | null }>(
      "/api/v1/households/mine"
    );
    setKitchens(data.items);
    setActiveId(data.activeHouseholdId);
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load kitchens");
    });
  }, [load]);

  if (kitchens.length < 2) return null;

  async function onChange(householdId: string) {
    setPending(true);
    setError(null);
    try {
      await api("/api/v1/households/select", {
        method: "POST",
        body: JSON.stringify({ householdId }),
      });
      window.location.assign("/recipes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch kitchens");
      setPending(false);
    }
  }

  return (
    <div className="kitchen-switcher">
      <label>
        <span>Active kitchen</span>
        <select
          value={activeId ?? ""}
          disabled={pending}
          onChange={(event) => void onChange(event.target.value)}
        >
          {kitchens.map((item) => (
            <option key={item.household.id} value={item.household.id}>
              {item.household.name}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}
