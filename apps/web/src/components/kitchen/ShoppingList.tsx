"use client";

import { useMemo, useState } from "react";
import { groupShopItemsByAisle, shopItemQuantity } from "@/lib/shop-aisles";
import type { ShopItem } from "@/lib/week-plan-view";

function extraItem(name: string, index: number): ShopItem {
  return {
    key: `extra-${index}-${name.toLowerCase()}`,
    name,
    recipes: [],
    warnings: [],
  };
}

export function ShoppingList({ items }: { items: ShopItem[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<ShopItem[]>([]);
  const [draft, setDraft] = useState("");

  const listed = useMemo(() => [...items, ...extras], [extras, items]);
  const groups = useMemo(() => groupShopItemsByAisle(listed), [listed]);

  function addExtra(event: React.FormEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setExtras((current) => [...current, extraItem(name, current.length)]);
    setDraft("");
  }

  if (listed.length === 0) {
    return (
      <div className="shop-board">
        <p className="empty-note">
          Nothing to shop for yet. Add dinners on the plan, or jot milk and paper towels below.
        </p>
        <ShopAdd value={draft} onChange={setDraft} onSubmit={addExtra} />
      </div>
    );
  }

  return (
    <div className="shop-board" data-testid="shopping-list">
      {groups.map((group) => (
        <section className="shop-aisle" key={group.aisle}>
          <h2 className="shop-aisle-title">{group.aisle}</h2>
          <ul className="shop-list">
            {group.items.map((item) => {
              const done = Boolean(checked[item.key]);
              const qty = shopItemQuantity(item);
              return (
                <li className={`shop-item${done ? " is-done" : ""}`} key={item.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() =>
                        setChecked((current) => ({ ...current, [item.key]: !current[item.key] }))
                      }
                    />
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
      <ShopAdd value={draft} onChange={setDraft} onSubmit={addExtra} />
    </div>
  );
}

function ShopAdd({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
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
      <button className="btn" type="submit" disabled={!value.trim()}>
        Add item
      </button>
    </form>
  );
}
