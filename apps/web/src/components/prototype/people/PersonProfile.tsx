"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  bucketLabel,
  catalogById,
  defaultBucketForItem,
  defaultOptionsForItem,
  newId,
  restrictionLabel,
  type Bucket,
  type CatalogItem,
  type Restriction,
} from "./model";
import { FoodPicker } from "./FoodPicker";
import { FoodIcon } from "./icons";
import { usePrototype } from "./store";
import { Avatar, Chip, ConfirmSheet, EmptyState, Segmented, Sheet } from "./ui";

const BUCKETS: Bucket[] = ["cant_have", "doesnt_eat", "rather_not"];

const SEVERITY_OPTIONS = [
  { value: "cant_have" as const, label: "Can't have" },
  { value: "doesnt_eat" as const, label: "Doesn't eat" },
  { value: "rather_not" as const, label: "Would rather not" },
];

export function PersonProfile({ personId }: { personId: string }) {
  const { household, addRestriction, updateRestriction, removeRestriction, deletePerson } =
    usePrototype();
  const router = useRouter();
  const person = household.people.find((item) => item.id === personId);
  const [editing, setEditing] = useState<Restriction | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeAdding = useCallback(() => setAdding(false), []);
  const closeDelete = useCallback(() => setConfirmDelete(false), []);

  const grouped = useMemo(() => {
    const map: Record<Bucket, Restriction[]> = {
      cant_have: [],
      doesnt_eat: [],
      rather_not: [],
    };
    for (const restriction of person?.restrictions ?? []) {
      map[restriction.bucket].push(restriction);
    }
    return map;
  }, [person]);

  if (!person) {
    return (
      <EmptyState
        title="Not in this kitchen"
        body="They may have been removed."
        action={
          <Link href="/prototype/people" className="olp-btn olp-btn-primary">
            Back to People
          </Link>
        }
      />
    );
  }

  return (
    <div className="olp-stack">
      <Link href="/prototype/people" className="olp-back">
        ← People
      </Link>
      <header className="olp-person-head">
        <Avatar person={person} size={48} />
        <h1>{person.name}</h1>
      </header>

      {BUCKETS.map((bucket) => (
        <section
          key={bucket}
          className={`olp-lane olp-lane-${bucket}`}
          data-testid={`bucket-${bucket}`}
        >
          <h2>{bucketLabel(bucket)}</h2>
          {grouped[bucket].length === 0 ? (
            <p className="olp-empty-inline">None</p>
          ) : (
            <div className="olp-chip-row">
              <AnimatePresence initial={false}>
                {grouped[bucket].map((restriction) => (
                  <Chip
                    key={restriction.id}
                    label={restrictionLabel(restriction)}
                    itemId={restriction.itemId}
                    bucket={restriction.bucket}
                    onClick={() => setEditing(restriction)}
                    onRemove={() => removeRestriction(person.id, restriction.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      ))}

      <div className="olp-row">
        <button type="button" className="olp-btn olp-btn-primary" onClick={() => setAdding(true)}>
          Add
        </button>
        <button
          type="button"
          className="olp-btn olp-btn-danger-ghost"
          onClick={() => setConfirmDelete(true)}
        >
          Delete {person.name}
        </button>
      </div>

      <Sheet
        open={Boolean(editing)}
        title={editing ? restrictionLabel(editing) : "Edit"}
        onClose={closeEditing}
      >
        {editing ? (
          <RestrictionEditor
            key={editing.id}
            restriction={editing}
            onChange={(next) => {
              updateRestriction(person.id, next);
              setEditing(next);
            }}
            onClose={closeEditing}
          />
        ) : null}
      </Sheet>

      <Sheet open={adding} title="Add a rule" onClose={closeAdding}>
        <AddRuleForm
          key="add-rule-form"
          selectedIds={person.restrictions.map((item) => item.itemId)}
          onDone={(restriction) => {
            addRestriction(person.id, restriction);
            closeAdding();
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title={`Remove ${person.name}?`}
        body={`${person.name} and their rules will be removed.`}
        confirmLabel={`Delete ${person.name}`}
        onCancel={closeDelete}
        onConfirm={() => {
          deletePerson(person.id);
          setConfirmDelete(false);
          router.push("/prototype/people");
        }}
      />
    </div>
  );
}

function AddRuleForm({
  selectedIds,
  onDone,
}: {
  selectedIds: string[];
  onDone: (restriction: Restriction) => void;
}) {
  const [item, setItem] = useState<CatalogItem | null>(null);
  const [bucket, setBucket] = useState<Bucket>("cant_have");
  const [coconutAsTreeNut, setCoconutAsTreeNut] = useState(false);
  const already = item ? selectedIds.includes(item.id) : false;

  function selectItem(next: CatalogItem) {
    setItem(next);
    setBucket(defaultBucketForItem(next));
    setCoconutAsTreeNut(false);
  }

  return (
    <div className="olp-stack-sm">
      {item ? (
        <>
          <button type="button" className="olp-choice is-on" onClick={() => setItem(null)}>
            <span className="olp-tile-icon">
              <FoodIcon id={item.id} size={22} />
            </span>
            <b>{item.label}</b>
          </button>
          <Segmented
            label="Severity"
            value={bucket}
            onChange={setBucket}
            options={SEVERITY_OPTIONS}
          />
          {item.id === "tree_nut" ? (
            <label className="olp-check">
              <input
                type="checkbox"
                checked={coconutAsTreeNut}
                onChange={(event) => setCoconutAsTreeNut(event.target.checked)}
              />
              Treat coconut as a tree nut
            </label>
          ) : null}
          <button
            type="button"
            className="olp-btn olp-btn-primary"
            disabled={already}
            onClick={() =>
              onDone({
                id: newId("r"),
                itemId: item.id,
                bucket,
                options: {
                  ...defaultOptionsForItem(item),
                  coconutAsTreeNut: item.id === "tree_nut" ? coconutAsTreeNut : undefined,
                },
              })
            }
          >
            Done
          </button>
        </>
      ) : (
        <FoodPicker selectedId={item?.id} onSelect={selectItem} />
      )}
    </div>
  );
}

function RestrictionEditor({
  restriction,
  onChange,
  onClose,
}: {
  restriction: Restriction;
  onChange: (restriction: Restriction) => void;
  onClose: () => void;
}) {
  const item = catalogById(restriction.itemId);
  const showCoconut = item?.id === "tree_nut";

  return (
    <div className="olp-stack-sm">
      <Segmented
        label="Severity"
        value={restriction.bucket}
        onChange={(bucket) => onChange({ ...restriction, bucket })}
        options={SEVERITY_OPTIONS}
      />
      {showCoconut ? (
        <label className="olp-check">
          <input
            type="checkbox"
            checked={Boolean(restriction.options.coconutAsTreeNut)}
            onChange={(event) =>
              onChange({
                ...restriction,
                options: { ...restriction.options, coconutAsTreeNut: event.target.checked },
              })
            }
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
