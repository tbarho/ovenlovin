"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  RULE_UI_BUCKETS,
  buildRuleWrite,
  defaultBucketForCatalogGroup,
  defaultSharedFacilityPrompt,
  displayNameForTarget,
  intentAndSeverityForBucket,
  personRemovalCopy,
  promptFromSharedFacility,
  sharedFacilityFromPrompt,
  showsCoconutToggle,
  showsSharedFacilityPrompt,
  uiBucketForRule,
  type CatalogEntry,
  type RuleUiBucket,
  type SharedFacilityPrompt,
} from "@ovenlovin/allergens";
import type { Person, PersonRule } from "@ovenlovin/core";
import { api } from "@/lib/browser-api";
import { entryForRule } from "@/lib/people-catalog";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  appearanceForPerson,
  parsePersonNotes,
  writePersonNotes,
} from "@/lib/person-appearance";
import { FoodPicker } from "./FoodPicker";
import { Avatar, Chip, ConfirmSheet, Segmented, Sheet, Toast } from "./ui";

const SEVERITY_OPTIONS = RULE_UI_BUCKETS.map((item) => ({
  value: item.bucket,
  label: item.label,
}));

const FACILITY_OPTIONS: Array<{ value: SharedFacilityPrompt; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "ask", label: "Ask me" },
  { value: "no", label: "No" },
];

export function PersonPage({ person, rules: initialRules }: { person: Person; rules: PersonRule[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PersonRule | null>(null);
  const [editPerson, setEditPerson] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeAdding = useCallback(() => setAdding(false), []);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeEditPerson = useCallback(() => setEditPerson(false), []);
  const closeDelete = useCallback(() => setConfirmDelete(false), []);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const grouped = useMemo(() => {
    const map: Record<RuleUiBucket, PersonRule[]> = {
      cant_have: [],
      doesnt_eat: [],
      rather_not: [],
    };
    for (const rule of rules) {
      map[uiBucketForRule(rule)].push(rule);
    }
    return map;
  }, [rules]);

  const appearance = appearanceForPerson(person);
  const removal = personRemovalCopy(person.displayName, rules.length);

  async function persistRule(entry: CatalogEntry, bucket: RuleUiBucket, extras: {
    facility: SharedFacilityPrompt;
    coconut: boolean;
    existing?: PersonRule;
  }) {
    const { intent, severity } = intentAndSeverityForBucket(bucket, entry.group);
    const payload = buildRuleWrite({
      intent,
      target: entry.code,
      severity,
      sharedFacility: showsSharedFacilityPrompt(entry.code)
        ? sharedFacilityFromPrompt(extras.facility)
        : "ignore",
      treatCoconutAsTreeNut: showsCoconutToggle(entry.code) ? extras.coconut : true,
    });
    if (extras.existing) {
      return api<PersonRule>(`/api/v1/people/${person.id}/rules/${extras.existing.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    }
    return api<PersonRule>(`/api/v1/people/${person.id}/rules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async function addRule(entry: CatalogEntry, bucket: RuleUiBucket, extras: {
    facility: SharedFacilityPrompt;
    coconut: boolean;
  }) {
    setError(null);
    try {
      const created = await persistRule(entry, bucket, extras);
      setRules((current) => [created, ...current.filter((rule) => rule.id !== created.id)]);
      setAdding(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rule");
    }
  }

  async function updateRule(rule: PersonRule, bucket: RuleUiBucket, extras: {
    facility: SharedFacilityPrompt;
    coconut: boolean;
  }) {
    const entry = entryForRule(rule.target, rule.kind);
    if (!entry) return;
    setError(null);
    try {
      const updated = await persistRule(entry, bucket, { ...extras, existing: rule });
      setRules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditing(updated);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update rule");
    }
  }

  async function removeRule(rule: PersonRule) {
    setError(null);
    const label = displayNameForTarget(rule.target);
    setRules((current) => current.filter((item) => item.id !== rule.id));
    try {
      await api(`/api/v1/people/${person.id}/rules/${rule.id}`, { method: "DELETE" });
      router.refresh();
      setToast({
        message: `Removed ${label}`,
        undo: () => {
          void undoRemove(rule);
        },
      });
    } catch (err) {
      setRules((current) => [rule, ...current]);
      setError(err instanceof Error ? err.message : "Could not remove rule");
    }
  }

  async function undoRemove(rule: PersonRule) {
    setToast(null);
    try {
      const restored = await api<PersonRule>(`/api/v1/people/${person.id}/rules`, {
        method: "POST",
        body: JSON.stringify({
          kind: rule.kind,
          target: rule.target,
          severity: rule.severity,
          sharedFacility: rule.sharedFacility,
          includeMayContain: rule.includeMayContain,
          includeCrossContact: rule.includeCrossContact,
          includeDescendants: rule.includeDescendants,
          treatCoconutAsTreeNut: rule.treatCoconutAsTreeNut,
          label: rule.label,
          note: rule.note,
        }),
      });
      setRules((current) => [restored, ...current.filter((item) => item.id !== restored.id)]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo");
    }
  }

  async function deletePerson() {
    setError(null);
    try {
      await api(`/api/v1/people/${person.id}`, { method: "DELETE" });
      router.push("/people");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove person");
    }
  }

  return (
    <div className="olp kitchen-people">
      <div className="olp-stack">
        <Link href="/people" className="olp-back">
          ← People
        </Link>
        <header className="olp-person-head">
          <Avatar name={person.displayName} appearance={appearance} size={48} />
          <h1>{person.displayName}</h1>
        </header>

        {RULE_UI_BUCKETS.map((item) => (
          <section
            key={item.bucket}
            className={`olp-lane olp-lane-${item.bucket}`}
            data-testid={`bucket-${item.bucket}`}
          >
            <h2>{item.label}</h2>
            {grouped[item.bucket].length === 0 ? (
              <p className="olp-empty-inline">None</p>
            ) : (
              <div className="olp-chip-row">
                <AnimatePresence initial={false}>
                  {grouped[item.bucket].map((rule) => (
                    <Chip
                      key={rule.id}
                      label={displayNameForTarget(rule.target)}
                      target={rule.target}
                      bucket={item.bucket}
                      onClick={() => setEditing(rule)}
                      onRemove={() => {
                        void removeRule(rule);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        ))}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="olp-row">
          <button type="button" className="olp-btn olp-btn-primary" onClick={() => setAdding(true)}>
            Add
          </button>
          <button type="button" className="olp-btn" onClick={() => setEditPerson(true)}>
            Edit {person.displayName}
          </button>
          <button
            type="button"
            className="olp-btn olp-btn-danger-ghost"
            onClick={() => setConfirmDelete(true)}
          >
            Delete {person.displayName}
          </button>
        </div>
      </div>

      <Sheet open={adding} title="Add a rule" onClose={closeAdding}>
        <AddRuleForm
          key="add-rule-form"
          selectedTargets={rules.map((rule) => rule.target)}
          onDone={(entry, bucket, extras) => {
            void addRule(entry, bucket, extras);
          }}
        />
      </Sheet>

      <Sheet
        open={Boolean(editing)}
        title={editing ? displayNameForTarget(editing.target) : "Edit"}
        onClose={closeEditing}
      >
        {editing ? (
          <RuleEditor
            key={editing.id}
            rule={editing}
            onChange={(bucket, extras) => {
              void updateRule(editing, bucket, extras);
            }}
            onClose={closeEditing}
          />
        ) : null}
      </Sheet>

      <Sheet open={editPerson} title="Edit person" onClose={closeEditPerson}>
        <EditPersonForm person={person} onClose={closeEditPerson} />
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title={removal.title}
        body={removal.body}
        confirmLabel={`Delete ${person.displayName}`}
        onCancel={closeDelete}
        onConfirm={() => {
          void deletePerson();
        }}
      />

      <Toast
        message={toast?.message ?? null}
        onUndo={toast?.undo}
        onDismiss={() => setToast(null)}
      />
    </div>
  );
}

function AddRuleForm({
  selectedTargets,
  onDone,
}: {
  selectedTargets: string[];
  onDone: (
    entry: CatalogEntry,
    bucket: RuleUiBucket,
    extras: { facility: SharedFacilityPrompt; coconut: boolean }
  ) => void;
}) {
  const [item, setItem] = useState<CatalogEntry | null>(null);
  const [bucket, setBucket] = useState<RuleUiBucket>("cant_have");
  const [facility, setFacility] = useState<SharedFacilityPrompt>("ask");
  const [coconut, setCoconut] = useState(false);
  const already = item ? selectedTargets.includes(item.code) : false;

  function selectItem(next: CatalogEntry) {
    setItem(next);
    setBucket(defaultBucketForCatalogGroup(next.group));
    setFacility(defaultSharedFacilityPrompt(next.code));
    setCoconut(false);
  }

  return (
    <div className="olp-stack-sm">
      {item ? (
        <>
          <button type="button" className="olp-choice is-on" onClick={() => setItem(null)}>
            <b>{item.name}</b>
          </button>
          <Segmented
            label="Severity"
            value={bucket}
            onChange={setBucket}
            options={SEVERITY_OPTIONS}
          />
          {showsSharedFacilityPrompt(item.code) ? (
            <fieldset className="olp-fieldset">
              <legend>Avoid foods made where nuts are processed?</legend>
              <Segmented
                label="Shared facility"
                value={facility}
                onChange={setFacility}
                options={FACILITY_OPTIONS}
              />
            </fieldset>
          ) : null}
          {showsCoconutToggle(item.code) ? (
            <label className="olp-check">
              <input
                type="checkbox"
                checked={coconut}
                onChange={(event) => setCoconut(event.target.checked)}
              />
              Treat coconut as a tree nut
            </label>
          ) : null}
          <button
            type="button"
            className="olp-btn olp-btn-primary"
            disabled={already}
            onClick={() => onDone(item, bucket, { facility, coconut })}
          >
            Done
          </button>
        </>
      ) : (
        <FoodPicker onSelect={selectItem} />
      )}
    </div>
  );
}

function RuleEditor({
  rule,
  onChange,
  onClose,
}: {
  rule: PersonRule;
  onChange: (
    bucket: RuleUiBucket,
    extras: { facility: SharedFacilityPrompt; coconut: boolean }
  ) => void;
  onClose: () => void;
}) {
  const [bucket, setBucket] = useState<RuleUiBucket>(uiBucketForRule(rule));
  const [facility, setFacility] = useState<SharedFacilityPrompt>(
    promptFromSharedFacility(rule.sharedFacility)
  );
  const [coconut, setCoconut] = useState(rule.treatCoconutAsTreeNut);
  const showFacility = showsSharedFacilityPrompt(rule.target);
  const showCoconut = showsCoconutToggle(rule.target);

  return (
    <div className="olp-stack-sm">
      <Segmented
        label="Severity"
        value={bucket}
        onChange={(next) => {
          setBucket(next);
          onChange(next, { facility, coconut });
        }}
        options={SEVERITY_OPTIONS}
      />
      {showFacility ? (
        <fieldset className="olp-fieldset">
          <legend>Avoid foods made where nuts are processed?</legend>
          <Segmented
            label="Shared facility"
            value={facility}
            onChange={(next) => {
              setFacility(next);
              onChange(bucket, { facility: next, coconut });
            }}
            options={FACILITY_OPTIONS}
          />
        </fieldset>
      ) : null}
      {showCoconut ? (
        <label className="olp-check">
          <input
            type="checkbox"
            checked={coconut}
            onChange={(event) => {
              setCoconut(event.target.checked);
              onChange(bucket, { facility, coconut: event.target.checked });
            }}
          />
          Treat coconut as a tree nut
        </label>
      ) : null}
      <button type="button" className="olp-btn olp-btn-primary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}

function EditPersonForm({ person, onClose }: { person: Person; onClose: () => void }) {
  const router = useRouter();
  const current = appearanceForPerson(person);
  const { text } = parsePersonNotes(person.notes);
  const [name, setName] = useState(person.displayName);
  const [emoji, setEmoji] = useState(current.emoji);
  const [color, setColor] = useState(current.color);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/v1/people/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: trimmed,
          notes: writePersonNotes({ emoji, color }, text),
        }),
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update person");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="olp-stack-sm">
      <label className="olp-field">
        Name
        <input
          key="edit-person-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="olp-identity-preview">
        <Avatar name={name || "?"} appearance={{ emoji, color }} size={44} />
      </div>
      <div className="olp-emoji-grid">
        {AVATAR_EMOJIS.map((item) => (
          <button
            key={item}
            type="button"
            className={emoji === item ? "is-on" : undefined}
            onClick={() => setEmoji(item)}
            aria-label={`Use ${item}`}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="olp-color-grid">
        {AVATAR_COLORS.map((item) => (
          <button
            key={item}
            type="button"
            className={color === item ? "is-on" : undefined}
            style={{ background: item }}
            onClick={() => setColor(item)}
            aria-label={`Use color ${item}`}
          />
        ))}
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button
        type="button"
        className="olp-btn olp-btn-primary"
        disabled={!name.trim() || pending}
        onClick={() => {
          void save();
        }}
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
