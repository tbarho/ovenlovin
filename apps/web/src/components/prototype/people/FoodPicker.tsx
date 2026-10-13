"use client";

import { useMemo, useState } from "react";
import { FoodIcon } from "./icons";
import { searchCatalog, type CatalogItem } from "./model";

export function FoodPicker({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (item: CatalogItem) => void;
}) {
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => searchCatalog(query), [query]);
  const showingSearch = query.trim().length > 0;

  return (
    <div className="olp-picker">
      <label className="olp-search">
        <span className="olp-sr">Search foods</span>
        <input
          key="food-search-input"
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
            const on = selectedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`tile-${item.id}`}
                className={`olp-tile${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onSelect(item)}
              >
                <span className="olp-tile-icon">
                  <FoodIcon id={item.id} size={22} />
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
