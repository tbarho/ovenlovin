"use client";

import { useState } from "react";
import type { ShopItem } from "@/lib/week-plan-view";

export function ShoppingList({ items }: { items: ShopItem[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return (
      <p className="empty-note">
        Nothing to shop for yet. Add dinners on the plan and the list will fill in.
      </p>
    );
  }

  return (
    <ul className="shop-list" data-testid="shopping-list">
      {items.map((item) => {
        const done = Boolean(checked[item.key]);
        const qty =
          item.displayQuantity != null
            ? `${item.displayQuantity}${item.displayUnit ? ` ${item.displayUnit}` : ""}`
            : item.quantity != null
              ? `${Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2)}${
                  item.unit ? ` ${item.unit}` : ""
                }`
              : null;
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
  );
}
