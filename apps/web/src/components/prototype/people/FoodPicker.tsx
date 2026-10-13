"use client";

import { useMemo, useState } from "react";
import { FEATURED_TILES, searchCatalog, type CatalogItem, type Restriction } from "./model";

export function FoodPicker({
  selectedIds,
  onToggle,
  caption,
}: {
  selectedIds: string[];
  onToggle: (item: CatalogItem) => void;
  caption?: string;
}) {
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => searchCatalog(query), [query]);
  const selected = new Set(selectedIds);
  const showingSearch = query.trim().length > 0;

  return (
    <div className="olp-picker">
      {caption ? <p className="olp-caption">{caption}</p> : null}
      <label className="olp-search">
        <span className="olp-sr">Search foods and diets</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search garlic, coconut, pork…"
        />
      </label>
      {!showingSearch ? (
        <p className="olp-kicker">Top 9 allergens and common diets</p>
      ) : (
        <p className="olp-kicker">{tiles.length === 0 ? "No matches" : "Search results"}</p>
      )}
      {tiles.length === 0 ? (
        <p className="olp-muted">
          Nothing named that yet. Try a simpler word — like “nut” or “dairy”.
        </p>
      ) : (
        <div className="olp-tile-grid">
          {tiles.map((item) => {
            const on = selected.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`tile-${item.id}`}
                className={`olp-tile${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() => onToggle(item)}
              >
                <span className="olp-tile-emoji" aria-hidden="true">
                  {item.emoji}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
      {!showingSearch && selectedIds.length === 0 ? (
        <p className="olp-hint">
          Tap a tile to add it as “Can&apos;t have”. You can sort it later.
        </p>
      ) : null}
    </div>
  );
}

export function selectedFromRestrictions(restrictions: Restriction[]): string[] {
  return restrictions.map((item) => item.itemId);
}

export { FEATURED_TILES };
