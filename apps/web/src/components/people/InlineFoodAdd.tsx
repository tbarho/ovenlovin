"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CatalogEntry } from "@ovenlovin/allergens";
import { FoodIcon } from "@/components/prototype/people/icons";
import {
  customCatalogOffer,
  iconIdForTarget,
  resolveFoodAdd,
  searchPeopleCatalog,
  unknownAllergenWarning,
  type PeoplePickerMode,
} from "@/lib/people-catalog";

const MODE_LABEL: Record<PeoplePickerMode, string> = {
  cant_eat: "Can't eat",
  doesnt_like: "Doesn't like",
  loves: "Loves",
};

export function InlineFoodAdd({
  mode,
  selectedTargets,
  onSelect,
  onSelectDislike,
}: {
  mode: PeoplePickerMode;
  selectedTargets: string[];
  onSelect: (item: CatalogEntry) => void;
  onSelectDislike?: (item: CatalogEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [unknown, setUnknown] = useState<{
    entry: CatalogEntry;
    suggestion: CatalogEntry | null;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputKey = `inline-add-${mode}`;
  const tiles = useMemo(() => searchPeopleCatalog(query, { mode, limit: 24 }), [mode, query]);
  const custom = useMemo(() => customCatalogOffer(query), [query]);
  const available = tiles.filter((item) => !selectedTargets.includes(item.code));

  function add(entry: CatalogEntry) {
    if (selectedTargets.includes(entry.code)) return;
    onSelect(entry);
    setQuery("");
    setUnknown(null);
    setOpen(true);
    inputRef.current?.focus();
  }

  function requestCustom(entry: CatalogEntry, suggestion: CatalogEntry | null) {
    if (mode === "cant_eat") {
      setUnknown({ entry, suggestion });
      setOpen(false);
      return;
    }
    add(entry);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setUnknown(null);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const resolved = resolveFoodAdd(query, { mode, selectedTargets });
    if (!resolved) return;
    if (resolved.kind === "canonical") {
      add(resolved.entry);
      return;
    }
    requestCustom(resolved.entry, resolved.suggestion);
  }

  return (
    <div className="olp-inline-add">
      <label className="olp-inline-add-field">
        <span className="olp-sr">Add to {MODE_LABEL[mode]}</span>
        <input
          key={inputKey}
          ref={inputRef}
          value={query}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Add…"
          onChange={(event) => {
            setQuery(event.target.value);
            setUnknown(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </label>
      {unknown ? (
        <div className="olp-unknown-confirm" data-testid="unknown-allergen-confirm" role="status">
          <p>{unknownAllergenWarning(unknown.entry.name, unknown.suggestion)}</p>
          {unknown.suggestion ? (
            <button
              type="button"
              className="olp-typeahead-item"
              data-testid="use-suggested-allergen"
              onClick={() => {
                const suggested = unknown.suggestion;
                if (suggested) add(suggested);
              }}
            >
              Use {unknown.suggestion.name}
            </button>
          ) : null}
          <button
            type="button"
            className="olp-typeahead-item"
            data-testid="save-unknown-allergy"
            onClick={() => add(unknown.entry)}
          >
            Save ‘{unknown.entry.name}’ as an allergy
          </button>
          {onSelectDislike ? (
            <button
              type="button"
              className="olp-typeahead-item"
              data-testid="save-unknown-dislike"
              onClick={() => {
                onSelectDislike(unknown.entry);
                setQuery("");
                setUnknown(null);
                setOpen(true);
                inputRef.current?.focus();
              }}
            >
              Save ‘{unknown.entry.name}’ as a dislike
            </button>
          ) : null}
          <button type="button" className="olp-typeahead-item" onClick={() => setUnknown(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      {open && !unknown && (custom || available.length > 0) ? (
        <ul className="olp-typeahead" role="listbox" aria-label={`${MODE_LABEL[mode]} suggestions`}>
          {custom ? (
            <li>
              <button
                type="button"
                className="olp-typeahead-item"
                data-testid="use-custom"
                onClick={() => requestCustom(custom, available[0] ?? null)}
              >
                Use ‘{custom.name}’
              </button>
            </li>
          ) : null}
          {available.map((item) => (
            <li key={`${item.group}-${item.code}`}>
              <button
                type="button"
                className="olp-typeahead-item"
                data-testid={`tile-${item.code}`}
                onClick={() => add(item)}
              >
                <FoodIcon id={iconIdForTarget(item.code)} size={18} />
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
