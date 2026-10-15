import type { AllergenRelation, Severity } from "@ovenlovin/core";
import { humanizeTarget } from "./catalog";

const MACHINE_SEVERITY = /\b(?:block|warn|prefer_avoid)\s*:\s*[a-z0-9_]+\b/i;
const MACHINE_SEVERITY_ALL = /\b(?:block|warn|prefer_avoid)\s*:\s*[a-z0-9_]+\b/gi;
const MACHINE_CODE = /\b[a-z]+(?:_[a-z0-9]+)+\b/g;

export function humanFoodName(codeOrName: string | null | undefined): string {
  const raw = codeOrName?.trim();
  if (!raw) return "this allergen";
  return humanizeTarget(raw);
}

function containsLead(food: string, relation?: AllergenRelation | string | null): string {
  switch (relation) {
    case "may_contain":
      return `May contain ${food}`;
    case "derived_from":
      return `Is made from ${food}`;
    case "commonly_cross_contact":
      return `May have shared a facility with ${food}`;
    default:
      return `Contains ${food}`;
  }
}

/**
 * Kitchen-facing finding copy. Never includes severity codes or allergen slugs.
 * Example: "Contains tree nuts, so Child B can't eat this"
 */
export function formatPlainFinding(input: {
  personName: string;
  severity: Severity;
  allergenCode?: string | null;
  allergenName?: string | null;
  ingredientName?: string | null;
  relation?: AllergenRelation | string | null;
  note?: string | null;
}): string {
  const fromCode = input.allergenCode ? humanFoodName(input.allergenCode) : "";
  const fromName =
    input.allergenName && !input.allergenName.includes("_")
      ? humanFoodName(input.allergenName)
      : "";
  const food =
    fromCode && fromCode !== "this allergen"
      ? fromCode
      : fromName || humanFoodName(input.allergenCode || input.allergenName);
  const person = input.personName.trim() || "This person";
  const lead = containsLead(food, input.relation);

  let message =
    input.severity === "block"
      ? `${lead}, so ${person} can't eat this`
      : input.severity === "warn"
        ? `${lead}, so check with ${person} first`
        : `${lead}, and ${person} usually skips this`;

  const note = input.note?.trim();
  if (note && !MACHINE_SEVERITY.test(note) && !note.includes("_")) {
    message += `. ${note}`;
  }
  return message;
}

export function formatUnmappedPlainFinding(input: {
  personName: string;
  ingredientName: string;
}): string {
  const person = input.personName.trim() || "This person";
  const ingredient = input.ingredientName.trim() || "this ingredient";
  return `We could not confirm "${ingredient}", so check with ${person} before serving`;
}

/** Rewrite leftover machine codes if a legacy message slips into the UI. */
export function sanitizeWarningCopy(message: string): string {
  return message
    .replace(MACHINE_SEVERITY_ALL, "")
    .replace(MACHINE_CODE, (code) => humanizeTarget(code))
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .trim();
}
