"use client";

import { useMemo, useState } from "react";
import { normalizeIngredientName } from "@ovenlovin/core/parsing";
import { api } from "@/lib/browser-api";
import { groupShopItemsByAisle, shopItemQuantity } from "@/lib/shop-aisles";
import type { ShopItem, ShoppingExtra, ShoppingTripState } from "@/lib/week-plan-view";

function extraShopItem(extra: ShoppingExtra): ShopItem {
  return {
    key: extra.key,
    name: extra.name,
    recipes: [],
    warnings: [],
  };
}

function extraKey(name: string): string {
  const slug = normalizeIngredientName(name) || name.trim().toLowerCase() || "item";
  const nonce =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `extra:${slug}:${nonce}`;
}

export function ShoppingList({
  items,
  planId = null,
  checkedKeys = [],
  extras = [],
}: {
  items: ShopItem[];
  planId?: string | null;
  checkedKeys?: string[];
  extras?: ShoppingExtra[];
}) {
  const [checked, setChecked] = useState<string[]>(checkedKeys);
  const [added, setAdded] = useState<ShoppingExtra[]>(extras);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listed = useMemo(() => [...items, ...added.map(extraShopItem)], [added, items]);
  const groups = useMemo(() => groupShopItemsByAisle(listed), [listed]);
  const checkedSet = useMemo(() => new Set(checked), [checked]);

  function persist(next: ShoppingTripState) {
    if (!planId) return;
    setPending(true);
    setError(null);
    void api(`/api/v1/meal-plans/${planId}/shopping-list/state`, {
      method: "PATCH",
      body: JSON.stringify(next),
    })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not save the list");
      })
      .finally(() => setPending(false));
  }

  function toggle(key: string) {
    const nextChecked = checkedSet.has(key)
      ? checked.filter((item) => item !== key)
      : [...checked, key];
    setChecked(nextChecked);
    persist({ checkedKeys: nextChecked, extras: added });
  }

  function addExtra(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const nextExtras = [...added, { key: extraKey(name), name }];
    setAdded(nextExtras);
    setDraft("");
    persist({ checkedKeys: checked, extras: nextExtras });
  }

  if (listed.length === 0) {
    return (
      <div className="shop-board">
        <p className="empty-note">
          Nothing to shop for yet. Add dinners on the plan, or jot milk and paper towels below.
        </p>
        <ShopAdd value={draft} onChange={setDraft} onSubmit={addExtra} pending={pending} />
        {error ? <p className="muted">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="shop-board" data-testid="shopping-list" aria-busy={pending}>
      {groups.map((group) => (
        <section className="shop-aisle" key={group.aisle}>
          <h2 className="shop-aisle-title">{group.aisle}</h2>
          <ul className="shop-list">
            {group.items.map((item) => {
              const done = checkedSet.has(item.key);
              const qty = shopItemQuantity(item);
              return (
                <li className={`shop-item${done ? " is-done" : ""}`} key={item.key}>
                  <label>
                    <input type="checkbox" checked={done} onChange={() => toggle(item.key)} />
                    <span className="shop-item-body">
                      <strong>{item.name}</strong>
                      <span className="muted">
                        {[qty, item.recipes.length > 0 ? item.recipes.join(" · ") : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {item.warnings.map((warning) => (
                        <span
                          className="week-finding"
                          data-severity={warning.severity}
                          key={`${item.key}-${warning.personName}`}
                        >
                          {warning.message}
                        </span>
                      ))}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <ShopAdd value={draft} onChange={setDraft} onSubmit={addExtra} pending={pending} />
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}

function ShopAdd({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  pending: boolean;
}) {
  return (
    <form className="shop-add" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Add to the list</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Milk, paper towels…"
        />
      </label>
      <button className="btn" type="submit" disabled={!value.trim() || pending}>
        Add item
      </button>
    </form>
  );
}
