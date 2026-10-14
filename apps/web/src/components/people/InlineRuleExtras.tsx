"use client";

import type { CatalogEntry, SharedFacilityPrompt } from "@ovenlovin/allergens";
import { showsCoconutToggle, showsSharedFacilityPrompt } from "@ovenlovin/allergens";
import { Segmented } from "./ui";

const FACILITY_OPTIONS: Array<{ value: SharedFacilityPrompt; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "ask", label: "Ask me" },
  { value: "no", label: "No" },
];

export function InlineRuleExtras({
  entry,
  facility,
  coconut,
  already,
  onFacility,
  onCoconut,
  onCancel,
  onDone,
}: {
  entry: CatalogEntry;
  facility: SharedFacilityPrompt;
  coconut: boolean;
  already: boolean;
  onFacility: (value: SharedFacilityPrompt) => void;
  onCoconut: (value: boolean) => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div className="olp-inline-extras" data-testid="inline-rule-extras">
      <p className="olp-inline-extras-title">{entry.name}</p>
      {showsSharedFacilityPrompt(entry.code) ? (
        <fieldset className="olp-fieldset">
          <legend>Avoid foods made where nuts are processed?</legend>
          <Segmented
            label="Shared facility"
            value={facility}
            onChange={onFacility}
            options={FACILITY_OPTIONS}
          />
        </fieldset>
      ) : null}
      {showsCoconutToggle(entry.code) ? (
        <label className="olp-check">
          <input
            type="checkbox"
            checked={coconut}
            onChange={(event) => onCoconut(event.target.checked)}
          />
          Treat coconut as a tree nut
        </label>
      ) : null}
      <div className="olp-row">
        <button type="button" className="olp-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="olp-btn olp-btn-primary"
          disabled={already}
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}
