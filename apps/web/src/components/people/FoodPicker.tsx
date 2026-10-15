"use client";

import { useMemo, useState } from "react";
import type { CatalogEntry } from "@ovenlovin/allergens";
import { FoodIcon } from "@/components/prototype/people/icons";
import {
  customCatalogOffer,
  iconIdForTarget,
  resolveFoodAdd,
  searchPeopleCatalog,
  type PeoplePickerMode,
} from "@/lib/people-catalog";

export function FoodPicker({
  mode = "cant_eat",
  selectedId,
  onSelect,
}: {
  mode?: PeoplePickerMode;
  selectedId?: string;
  onSelect: (item: CatalogEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const tiles = useMemo(() => searchPeopleCatalog(query, { mode }), [mode, query]);
  const custom = useMemo(() => customCatalogOffer(query), [query]);
  const showingSearch = query.trim().length > 0;

  return (
    <div className="olp-picker">
      <label className="olp-search">
        <span className="olp-sr">Search foods</span>
        <input
          key="people-food-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const resolved = resolveFoodAdd(query, { mode });
            if (resolved?.kind === "canonical") onSelect(resolved.entry);
          }}
          placeholder="Search foods"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <p className="olp-kicker">{showingSearch ? "Results" : "Common"}</p>
      {custom ? (
        <button
          type="button"
          className="olp-use-custom"
          data-testid="use-custom"
          onClick={() => onSelect(custom)}
        >
          Use ‘{custom.name}’
        </button>
      ) : null}
      {tiles.length === 0 && !custom ? (
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
