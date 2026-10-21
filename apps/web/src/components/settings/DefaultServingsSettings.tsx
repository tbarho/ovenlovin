"use client";

import { useCallback, useEffect, useState } from "react";
import type { HouseholdServingsSettings } from "@ovenlovin/core";
import { SERVINGS_HARD_MAX } from "@ovenlovin/core/scaling";
import { api } from "@/lib/browser-api";

const MODES = [
  {
    value: "family" as const,
    title: "Match my family",
    description: "Open recipes at the larger of the card's yield and the number of people.",
  },
  {
    value: "fixed" as const,
    title: "A fixed number",
    description: "Always open recipes scaled to this many servings.",
  },
  {
    value: "recipe" as const,
    title: "Use the recipe's servings",
    description: "Keep each recipe at the servings stored on the card.",
  },
];

export function DefaultServingsSettings({ canWrite = true }: { canWrite?: boolean }) {
  const [settings, setSettings] = useState<HouseholdServingsSettings | null>(null);
  const [fixedCount, setFixedCount] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const data = await api<HouseholdServingsSettings>("/api/v1/households/settings");
    setSettings(data);
    setFixedCount(String(data.servings ?? data.defaultCookFor));
  }, []);

  useEffect(() => {
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load default servings");
    });
  }, [load]);

  async function save(mode: HouseholdServingsSettings["mode"], servings?: number | null) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const data = await api<HouseholdServingsSettings>("/api/v1/households/settings", {
        method: "PATCH",
        body: JSON.stringify({
          mode,
          servings: mode === "fixed" ? servings : null,
        }),
      });
      setSettings(data);
      if (data.servings) setFixedCount(String(data.servings));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save default servings");
    } finally {
      setPending(false);
    }
  }

  const familyLabel =
    settings && settings.familySize > 0
      ? `Match my family (${settings.familySize} ${settings.familySize === 1 ? "person" : "people"})`
      : "Match my family";

  return (
    <section
      className="kitchen-panel"
      aria-labelledby="default-servings-heading"
      data-testid="default-servings-settings"
    >
      <h2 id="default-servings-heading">Default servings</h2>
      <p className="muted">
        Used when you open a recipe, add dinner to the meal plan, and scale the shopping list. You
        can still change servings on each view.
      </p>
      {error ? <p className="muted">{error}</p> : null}
      {settings ? (
        <fieldset className="default-servings-options" disabled={pending || !canWrite}>
          <legend className="sr-only">Default servings</legend>
          {MODES.map((option) => (
            <label key={option.value} className="default-servings-option">
              <input
                type="radio"
                name="default-servings-mode"
                value={option.value}
                checked={settings.mode === option.value}
                onChange={() => {
                  if (option.value === "fixed") {
                    const count = Number(fixedCount) || settings.defaultCookFor;
                    void save("fixed", count);
                    return;
                  }
                  void save(option.value);
                }}
              />
              <span>
                <strong>{option.value === "family" ? familyLabel : option.title}</strong>
                <em>{option.description}</em>
              </span>
            </label>
          ))}
          {settings.mode === "fixed" ? (
            <label className="default-servings-count">
              <span>Servings</span>
              <input
                type="number"
                min={1}
                max={SERVINGS_HARD_MAX}
                value={fixedCount}
                aria-label="Fixed default servings"
                onChange={(event) => setFixedCount(event.target.value)}
                onBlur={() => {
                  const count = Number(fixedCount);
                  if (!Number.isFinite(count) || count < 1 || count > SERVINGS_HARD_MAX) {
                    setFixedCount(String(settings.servings ?? settings.defaultCookFor));
                    return;
                  }
                  if (count !== settings.servings) void save("fixed", count);
                }}
              />
            </label>
          ) : null}
        </fieldset>
      ) : (
        <p className="empty-note">Loading default servings…</p>
      )}
      {saved ? (
        <p className="default-servings-saved" role="status" data-testid="default-servings-saved">
          Saved
        </p>
      ) : null}
    </section>
  );
}
