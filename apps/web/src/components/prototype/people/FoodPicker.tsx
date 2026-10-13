"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { tapFeedback } from "./haptics";
import { FoodIcon } from "./icons";
import {
  FEATURED_TILES,
  catalogById,
  parseFoodPhrase,
  searchCatalog,
  suggestionsFor,
  type Bucket,
  type CatalogItem,
  type Restriction,
} from "./model";
import { Chip } from "./ui";

export function FoodPicker({
  selectedIds,
  onToggle,
  onAddParsed,
  caption,
}: {
  selectedIds: string[];
  onToggle: (item: CatalogItem) => void;
  onAddParsed?: (item: CatalogItem, bucket: Bucket) => void;
  caption?: string;
}) {
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => searchCatalog(query), [query]);
  const selected = new Set(selectedIds);
  const parsed = useMemo(() => parseFoodPhrase(query), [query]);
  const suggestions = useMemo(() => suggestionsFor(selectedIds), [selectedIds]);
  const showingSearch = query.trim().length > 0;

  function commitParsed() {
    if (!onAddParsed || parsed.length === 0) return;
    for (const entry of parsed) {
      const item = catalogById(entry.itemId);
      if (!item || selected.has(item.id)) continue;
      onAddParsed(item, entry.bucket);
    }
    tapFeedback(16);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && parsed.length > 0) {
      event.preventDefault();
      commitParsed();
    }
  }

  return (
    <div className="olp-picker">
      {caption ? <p className="olp-caption">{caption}</p> : null}
      <label className="olp-nl">
        <span className="olp-sr">Search foods or type a phrase</span>
        <input
          key="food-nl-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Try “no dairy, hates mushrooms”"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      {parsed.length > 0 ? (
        <div className="olp-parsed" data-testid="parsed-chips">
          {parsed.map((entry) => (
            <Chip
              key={entry.itemId}
              itemId={entry.itemId}
              label={catalogById(entry.itemId)?.label ?? entry.itemId}
              bucket={entry.bucket}
            />
          ))}
          {onAddParsed ? (
            <button type="button" className="olp-btn olp-btn-primary" onClick={commitParsed}>
              Add these
            </button>
          ) : null}
        </div>
      ) : null}
      {suggestions.length > 0 ? (
        <div className="olp-stack-sm">
          {suggestions.map((suggestion) => {
            const item = catalogById(suggestion.itemId);
            if (!item) return null;
            return (
              <div
                key={suggestion.itemId}
                className="olp-suggest"
                data-testid={`suggest-${item.id}`}
              >
                <p>{suggestion.reason}</p>
                <button
                  type="button"
                  className="olp-btn"
                  onClick={() => {
                    tapFeedback();
                    onToggle(item);
                  }}
                >
                  Add {item.label}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {!showingSearch ? (
        <p className="olp-kicker">Top allergens and common diets</p>
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
                onClick={() => {
                  tapFeedback(on ? 8 : 14);
                  onToggle(item);
                }}
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
      {!showingSearch && selectedIds.length === 0 ? (
        <p className="olp-hint">
          Allergens land as “Can&apos;t have”. Diets as “Doesn&apos;t eat”. Preferences stay soft.
        </p>
      ) : null}
    </div>
  );
}

export function selectedFromRestrictions(restrictions: Restriction[]): string[] {
  return restrictions.map((item) => item.itemId);
}

export { FEATURED_TILES };
