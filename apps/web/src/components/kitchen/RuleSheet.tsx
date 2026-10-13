"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, PersonRule } from "@ovenlovin/core";
import type { SharedFacility, Severity } from "@ovenlovin/core";
import {
  buildRuleWrite,
  defaultSeverityForIntent,
  describeRuleChip,
  describeRuleSummary,
  displayNameForTarget,
  draftFromRule,
  searchCatalog,
  severityExplanation,
  severityTitle,
  sharedFacilityExplanation,
  sharedFacilityTitle,
  type RuleDraft,
  type RuleIntent,
} from "@ovenlovin/allergens";
import { api } from "@/lib/browser-api";
import { BottomSheet } from "./BottomSheet";

const STEPS = ["type", "target", "severity", "facility", "review"] as const;
type Step = (typeof STEPS)[number];

const INTENTS: { id: RuleIntent; title: string; detail: string }[] = [
  { id: "allergy", title: "Allergy", detail: "A food this person cannot safely eat." },
  { id: "diet", title: "Diet", detail: "A way of eating, like vegetarian or gluten-free." },
  { id: "dislike", title: "Dislike", detail: "A food they prefer not to eat." },
];

const SEVERITIES: Severity[] = ["block", "warn", "prefer_avoid"];
const FACILITIES: SharedFacility[] = ["block", "warn", "ignore"];

function emptyDraft(intent: RuleIntent = "allergy"): RuleDraft {
  return {
    intent,
    target: "",
    severity: defaultSeverityForIntent(intent),
    sharedFacility: "ignore",
    treatCoconutAsTreeNut: true,
  };
}

export function RuleSheet({
  person,
  rule,
  open,
  onClose,
}: {
  person: Person;
  rule?: PersonRule | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(rule);
  const [step, setStep] = useState<Step>("type");
  const [draft, setDraft] = useState<RuleDraft>(() => (rule ? draftFromRule(rule) : emptyDraft()));
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(rule ? draftFromRule(rule) : emptyDraft());
    setStep("type");
    setQuery(rule ? displayNameForTarget(rule.target) : "");
    setError(null);
    setPending(false);
  }, [open, rule]);

  function reset() {
    setDraft(rule ? draftFromRule(rule) : emptyDraft());
    setStep("type");
    setQuery("");
    setError(null);
    setPending(false);
  }

  function close() {
    reset();
    onClose();
  }

  const results = useMemo(
    () => searchCatalog(query, { intent: draft.intent, limit: 12 }),
    [draft.intent, query]
  );

  const canContinue =
    step === "type" ||
    (step === "target" && draft.target.trim().length > 0) ||
    step === "severity" ||
    step === "facility" ||
    step === "review";

  function goNext() {
    const index = STEPS.indexOf(step);
    const next = STEPS[index + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const index = STEPS.indexOf(step);
    const prev = STEPS[index - 1];
    if (prev) setStep(prev);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const payload = buildRuleWrite(draft);
      if (rule) {
        await api(`/api/v1/people/${person.id}/rules/${rule.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/v1/people/${person.id}/rules`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      router.refresh();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rule");
    } finally {
      setPending(false);
    }
  }

  return (
    <BottomSheet open={open} title={editing ? "Edit rule" : "Add a rule"} onClose={close}>
      <ol className="sheet-steps" aria-label="Rule steps">
        {STEPS.map((item) => (
          <li key={item} className={item === step ? "is-current" : undefined}>
            {item}
          </li>
        ))}
      </ol>

      {step === "type" ? (
        <div className="choice-list">
          {INTENTS.map((intent) => (
            <button
              key={intent.id}
              type="button"
              className={`choice${draft.intent === intent.id ? " is-selected" : ""}`}
              onClick={() =>
                setDraft({
                  ...emptyDraft(intent.id),
                  treatCoconutAsTreeNut: draft.treatCoconutAsTreeNut,
                })
              }
            >
              <b>{intent.title}</b>
              <span>{intent.detail}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "target" ? (
        <div className="sheet-stack">
          <label className="field">
            <span className="field-label">
              {draft.intent === "allergy"
                ? "Search allergens"
                : draft.intent === "diet"
                  ? "Search diets"
                  : "Search or type a food"}
            </span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (draft.intent === "dislike") {
                  setDraft((current) => ({ ...current, target: event.target.value }));
                }
              }}
              placeholder={
                draft.intent === "allergy"
                  ? "Tree nuts, peanuts, dairy…"
                  : draft.intent === "diet"
                    ? "Vegetarian, gluten-free…"
                    : "Cilantro, olives…"
              }
            />
          </label>
          {draft.intent === "allergy" ? (
            <p className="field-hint">
              Peanuts and tree nuts are listed separately. Choose both if this person must avoid all
              nuts.
            </p>
          ) : null}
          <div className="choice-list">
            {results.map((entry) => (
              <button
                key={`${entry.group}-${entry.code}`}
                type="button"
                className={`choice${draft.target === entry.code ? " is-selected" : ""}`}
                onClick={() => {
                  setDraft((current) => ({ ...current, target: entry.code }));
                  setQuery(entry.name);
                }}
              >
                <b>{entry.name}</b>
                <span>
                  {entry.parentName ? `${entry.parentName} · ` : ""}
                  {entry.description ?? entry.phraseName}
                </span>
              </button>
            ))}
          </div>
          {draft.intent === "dislike" &&
          query.trim() &&
          !results.some((entry) => entry.code === draft.target) ? (
            <p className="field-hint">
              Using “{query.trim()}” as a custom dislike. That is stored as an ingredient rule.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === "severity" ? (
        <div className="choice-list">
          {SEVERITIES.map((severity) => (
            <button
              key={severity}
              type="button"
              className={`choice choice-${severity}${draft.severity === severity ? " is-selected" : ""}`}
              onClick={() => setDraft((current) => ({ ...current, severity }))}
            >
              <b>{severityTitle[severity]}</b>
              <span>{severityExplanation[severity]}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "facility" ? (
        <div className="sheet-stack">
          <p className="sheet-lead">
            If a package only says it was made in a facility that also processes this, what should
            OvenLovin do?
          </p>
          {draft.intent === "allergy" &&
          draft.severity === "block" &&
          draft.sharedFacility === "ignore" ? (
            <p className="safety-note">
              For a severe allergy, consider treating shared-facility foods as unsafe. This stays
              ignore until you choose otherwise.
            </p>
          ) : null}
          <div className="choice-list">
            {FACILITIES.map((facility) => (
              <button
                key={facility}
                type="button"
                className={`choice${draft.sharedFacility === facility ? " is-selected" : ""}`}
                onClick={() => setDraft((current) => ({ ...current, sharedFacility: facility }))}
              >
                <b>{sharedFacilityTitle[facility]}</b>
                <span>{sharedFacilityExplanation[facility]}</span>
              </button>
            ))}
          </div>
          {draft.target === "tree_nut" ? (
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={draft.treatCoconutAsTreeNut !== false}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    treatCoconutAsTreeNut: event.target.checked,
                  }))
                }
              />
              <span>
                <b>Treat coconut as a tree nut</b>
                <span className="field-hint">
                  Coconut is stored separately. Leave this on unless this person can eat coconut.
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}

      {step === "review" ? (
        <div className="sheet-stack">
          <p className="sheet-lead">
            {describeRuleSummary(person.displayName, {
              kind:
                draft.intent === "allergy"
                  ? "allergen"
                  : draft.intent === "diet"
                    ? "diet"
                    : "ingredient",
              target: draft.target,
              severity: draft.severity,
              sharedFacility: draft.sharedFacility,
            })}
          </p>
          <p className="field-hint">
            Chip:{" "}
            {
              describeRuleChip({
                kind:
                  draft.intent === "allergy"
                    ? "allergen"
                    : draft.intent === "diet"
                      ? "diet"
                      : "ingredient",
                target: draft.target,
                severity: draft.severity,
              }).text
            }
          </p>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="sheet-actions">
        {step === "type" ? (
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
        ) : (
          <button type="button" className="btn" onClick={goBack}>
            Back
          </button>
        )}
        {step === "review" ? (
          <button
            type="button"
            className="btn primary"
            onClick={save}
            disabled={pending || !canContinue}
          >
            {pending ? "Saving…" : editing ? "Save changes" : "Save rule"}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={goNext} disabled={!canContinue}>
            Continue
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
