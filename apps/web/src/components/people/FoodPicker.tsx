"use client";

import { useMemo, useState } from "react";
import type { CatalogEntry } from "@ovenlovin/allergens";
import { FoodIcon } from "@/components/prototype/people/icons";
import { iconIdForTarget, searchPeopleCatalog } from "@/lib/people-catalog";

export function FoodPicker({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (item: CatalogEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => searchPeopleCatalog(query), [query]);
  const showingSearch = query.trim().length > 0;

  return (
    <div className="olp-picker">
      <label className="olp-search">
        <span className="olp-sr">Search foods</span>
        <input
          key="people-food-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search foods"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <p className="olp-kicker">{showingSearch ? "Results" : "Common"}</p>
      {tiles.length === 0 ? (
        <p className="olp-muted">No matches.</p>
      ) : (
        <div className="olp-tile-grid">
          {tiles.map((item) => {
            const on = selectedId === item.code;
            return (
              <button
                key={`${item.group}-${item.code}`}
                type="button"
                data-testid={`tile-${item.code}`}
                className={`olp-tile${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onSelect(item)}
              >
                <span className="olp-tile-icon">
                  <FoodIcon id={iconIdForTarget(item.code)} size={22} />
                </span>
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
