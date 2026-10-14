"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  LOVE_PREFERENCE_TYPE,
  RULE_UI_BUCKETS,
  buildRuleWrite,
  defaultSharedFacilityPrompt,
  displayNameForTarget,
  intentAndSeverityForBucket,
  loveLabel,
  promptFromSharedFacility,
  sharedFacilityFromPrompt,
  showsCoconutToggle,
  showsSharedFacilityPrompt,
  uiBucketForRule,
  type CatalogEntry,
  type RuleUiBucket,
  type SharedFacilityPrompt,
} from "@ovenlovin/allergens";
import type { Person, PersonRule, Preference } from "@ovenlovin/core";
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

const FACILITY_OPTIONS: Array<{ value: SharedFacilityPrompt; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "ask", label: "Ask me" },
  { value: "no", label: "No" },
];

type AddTarget = RuleUiBucket | "loves";

const EMPTY_LOVES: Preference[] = [];

export function PersonPage({
  person,
  rules: initialRules,
  loves: initialLoves = EMPTY_LOVES,
}: {
  person: Person;
  rules: PersonRule[];
  loves?: Preference[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [loves, setLoves] = useState(initialLoves);
  const [adding, setAdding] = useState<AddTarget | null>(null);
  const [editing, setEditing] = useState<PersonRule | null>(null);
  const [editPerson, setEditPerson] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeAdding = useCallback(() => setAdding(null), []);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeEditPerson = useCallback(() => setEditPerson(false), []);
  const closeDelete = useCallback(() => setConfirmDelete(false), []);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  useEffect(() => {
    setLoves(initialLoves);
  }, [initialLoves]);

  const grouped = useMemo(() => {
    const map: Record<RuleUiBucket, PersonRule[]> = {
      cant_eat: [],
      doesnt_like: [],
    };
    for (const rule of rules) {
      map[uiBucketForRule(rule)].push(rule);
    }
    return map;
  }, [rules]);

  const appearance = appearanceForPerson(person);
  const removal = personRemovalCopy(person.displayName, rules.length + loves.length);

  async function persistRule(
    entry: CatalogEntry,
    bucket: RuleUiBucket,
    extras: {
      facility: SharedFacilityPrompt;
      coconut: boolean;
      existing?: PersonRule;
    }
  ) {
    const { intent, severity } = intentAndSeverityForBucket(bucket, entry.group);
    const payload = buildRuleWrite({
      intent,
      target: entry.code,
      severity,
      sharedFacility: showsSharedFacilityPrompt(entry.code)
        ? sharedFacilityFromPrompt(extras.facility)
        : "ignore",
      treatCoconutAsTreeNut: showsCoconutToggle(entry.code) ? extras.coconut : true,
      label: entry.name,
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

  async function addRule(
    entry: CatalogEntry,
    bucket: RuleUiBucket,
    extras: {
      facility: SharedFacilityPrompt;
      coconut: boolean;
    }
  ) {
    setError(null);
    try {
      const created = await persistRule(entry, bucket, extras);
      setRules((current) => [created, ...current.filter((rule) => rule.id !== created.id)]);
      setAdding(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rule");
    }
  }

  async function addLove(entry: CatalogEntry) {
    setError(null);
    try {
      const created = await api<Preference>(`/api/v1/people/${person.id}/preferences`, {
        method: "POST",
        body: JSON.stringify({
          type: LOVE_PREFERENCE_TYPE,
          value: entry.code,
        }),
      });
      setLoves((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setAdding(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save love");
    }
  }

  async function updateRule(
    rule: PersonRule,
    bucket: RuleUiBucket,
    extras: {
      facility: SharedFacilityPrompt;
      coconut: boolean;
    }
  ) {
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

  async function removeLove(item: Preference) {
    setError(null);
    const label = loveLabel(item.value);
    setLoves((current) => current.filter((row) => row.id !== item.id));
    try {
      await api(`/api/v1/people/${person.id}/preferences/${item.id}`, { method: "DELETE" });
      router.refresh();
      setToast({
        message: `Removed ${label}`,
        undo: () => {
          void undoRemoveLove(item);
        },
      });
    } catch (err) {
      setLoves((current) => [item, ...current]);
      setError(err instanceof Error ? err.message : "Could not remove love");
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

  async function undoRemoveLove(item: Preference) {
    setToast(null);
    try {
      const restored = await api<Preference>(`/api/v1/people/${person.id}/preferences`, {
        method: "POST",
        body: JSON.stringify({
          type: item.type,
          value: item.value,
          weight: item.weight,
        }),
      });
      setLoves((current) => [restored, ...current.filter((row) => row.id !== restored.id)]);
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

  const addTitle =
    adding === "loves" ? "Loves" : adding === "doesnt_like" ? "Doesn't like" : "Can't eat";

  return (
    <div className="olp kitchen-people kitchen-person">
      <div className="olp-stack">
        <Link href="/people" className="olp-back">
          ← People
        </Link>
        <header className="olp-person-head">
          <Avatar name={person.displayName} appearance={appearance} size={48} />
          <h1>{person.displayName}</h1>
        </header>

        <div className="person-lanes">
          {RULE_UI_BUCKETS.map((item) => (
            <section
              key={item.bucket}
              className={`olp-lane olp-lane-${item.bucket}`}
              data-testid={`bucket-${item.bucket}`}
            >
              <div className="olp-lane-head">
                <h2>{item.label}</h2>
                <button
                  type="button"
                  className="olp-text-btn"
                  onClick={() => setAdding(item.bucket)}
                >
                  Add
                </button>
              </div>
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

          <section className="olp-lane olp-lane-loves" data-testid="bucket-loves">
            <div className="olp-lane-head">
              <h2>Loves</h2>
              <button type="button" className="olp-text-btn" onClick={() => setAdding("loves")}>
                Add
              </button>
            </div>
            {loves.length === 0 ? (
              <p className="olp-empty-inline">None</p>
            ) : (
              <div className="olp-chip-row">
                <AnimatePresence initial={false}>
                  {loves.map((item) => (
                    <Chip
                      key={item.id}
                      label={loveLabel(item.value)}
                      target={item.value}
                      bucket="loves"
                      onRemove={() => {
                        void removeLove(item);
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="olp-row">
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

      <Sheet open={Boolean(adding)} title={addTitle} onClose={closeAdding}>
        {adding ? (
          <AddListForm
            key={adding}
            mode={adding}
            selectedTargets={
              adding === "loves"
                ? loves.map((item) => item.value)
                : rules
                    .filter((rule) => uiBucketForRule(rule) === adding)
                    .map((rule) => rule.target)
            }
            onPickRule={(entry, extras) => {
              if (adding === "loves") return;
              void addRule(entry, adding, extras);
            }}
            onPickLove={(entry) => {
              void addLove(entry);
            }}
          />
        ) : null}
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

function personRemovalCopy(personName: string, itemCount: number) {
  return {
    title: `Remove ${personName}?`,
    body:
      itemCount === 0
        ? `${personName} will be removed from this household.`
        : `${personName} and their ${itemCount} ${itemCount === 1 ? "item" : "items"} will be removed. Meal checks will no longer include ${personName}.`,
  };
}

function AddListForm({
  mode,
  selectedTargets,
  onPickRule,
  onPickLove,
}: {
  mode: AddTarget;
  selectedTargets: string[];
  onPickRule: (
    entry: CatalogEntry,
    extras: { facility: SharedFacilityPrompt; coconut: boolean }
  ) => void;
  onPickLove: (entry: CatalogEntry) => void;
}) {
  const [item, setItem] = useState<CatalogEntry | null>(null);
  const [facility, setFacility] = useState<SharedFacilityPrompt>("ask");
  const [coconut, setCoconut] = useState(false);
  const already = item ? selectedTargets.includes(item.code) : false;

  function selectItem(next: CatalogEntry) {
    if (mode === "loves") {
      onPickLove(next);
      return;
    }
    if (showsSharedFacilityPrompt(next.code) || showsCoconutToggle(next.code)) {
      setItem(next);
      setFacility(defaultSharedFacilityPrompt(next.code));
      setCoconut(false);
      return;
    }
    onPickRule(next, { facility: "no", coconut: true });
  }

  if (mode === "loves") {
    return <FoodPicker mode="loves" onSelect={selectItem} />;
  }

  return (
    <div className="olp-stack-sm">
      {item ? (
        <>
          <button type="button" className="olp-choice is-on" onClick={() => setItem(null)}>
            <b>{item.name}</b>
          </button>
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
            onClick={() => onPickRule(item, { facility, coconut })}
          >
            Done
          </button>
        </>
      ) : (
        <FoodPicker mode={mode} onSelect={selectItem} />
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
        label="List"
        value={bucket}
        onChange={(next) => {
          setBucket(next);
          onChange(next, { facility, coconut });
        }}
        options={RULE_UI_BUCKETS.map((item) => ({ value: item.bucket, label: item.label }))}
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
