"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type DragEvent } from "react";
import { LayoutGroup } from "framer-motion";
import {
  bucketHint,
  bucketLabel,
  catalogById,
  newId,
  restrictionEmoji,
  restrictionLabel,
  type Bucket,
  type Restriction,
} from "./model";
import { FoodPicker } from "./FoodPicker";
import { usePrototype } from "./store";
import { Avatar, Chip, ConfirmSheet, EmptyState, Segmented, Sheet } from "./ui";

const BUCKETS: Bucket[] = ["cant_have", "doesnt_eat", "rather_not"];

export function PersonProfile({ personId }: { personId: string }) {
  const {
    household,
    addRestriction,
    updateRestriction,
    moveRestriction,
    removeRestriction,
    deletePerson,
  } = usePrototype();
  const router = useRouter();
  const person = household.people.find((item) => item.id === personId);
  const [editing, setEditing] = useState<Restriction | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dropBucket, setDropBucket] = useState<Bucket | null>(null);

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
        title="That person isn’t in this kitchen"
        body="They may have been removed. Jump back to the household, or add someone in setup."
        action={
          <Link href="/prototype/people" className="olp-btn olp-btn-primary">
            Back to household
          </Link>
        }
      />
    );
  }

  function onDrop(bucket: Bucket, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const restrictionId = event.dataTransfer.getData("text/olp-restriction");
    if (restrictionId) moveRestriction(personId, restrictionId, bucket);
    setDropBucket(null);
  }

  return (
    <div className="olp-stack">
      <Link href="/prototype/people" className="olp-back">
        ← Household
      </Link>
      <header className="olp-person-head">
        <Avatar person={person} size={56} />
        <div>
          <p className="olp-kicker">{person.generation === "kid" ? "Kid" : "Adult"}</p>
          <h1>{person.name}</h1>
          <p className="olp-muted">
            Three lists, one meaning each. Drag a chip — or open it and move it.
          </p>
        </div>
      </header>

      <LayoutGroup>
        {BUCKETS.map((bucket) => (
          <section
            key={bucket}
            className={`olp-bucket${dropBucket === bucket ? " is-drop" : ""}`}
            data-testid={`bucket-${bucket}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDropBucket(bucket);
            }}
            onDragLeave={() => setDropBucket(null)}
            onDrop={(event) => onDrop(bucket, event)}
          >
            <div className="olp-section-head">
              <div>
                <h2>{bucketLabel(bucket)}</h2>
                <p className="olp-caption">{bucketHint(bucket)}</p>
              </div>
            </div>
            {grouped[bucket].length === 0 ? (
              <p className="olp-empty-inline">
                {bucket === "cant_have"
                  ? `Nothing ${person.name} is allergic to — yet.`
                  : bucket === "doesnt_eat"
                    ? `${person.name} hasn’t marked a diet.`
                    : `No soft preferences for ${person.name}.`}
              </p>
            ) : (
              <div className="olp-chip-row">
                {grouped[bucket].map((restriction) => (
                  <Chip
                    key={restriction.id}
                    label={restrictionLabel(restriction)}
                    emoji={restrictionEmoji(restriction)}
                    bucket={restriction.bucket}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/olp-restriction", restriction.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => setEditing(restriction)}
                    onRemove={() => removeRestriction(person.id, restriction.id)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </LayoutGroup>

      <div className="olp-row">
        <button type="button" className="olp-btn olp-btn-primary" onClick={() => setAdding(true)}>
          Add something
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
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <RestrictionEditor
            restriction={editing}
            personName={person.name}
            onChange={(next) => {
              updateRestriction(person.id, next);
              setEditing(next);
            }}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={adding}
        title={`Anything ${person.name} can’t or won’t eat?`}
        onClose={() => setAdding(false)}
      >
        <FoodPicker
          selectedIds={person.restrictions.map((item) => item.itemId)}
          caption="A tap adds it as Can’t have. Open the chip to move or fine-tune it."
          onToggle={(item) => {
            const existing = person.restrictions.find((entry) => entry.itemId === item.id);
            if (existing) {
              removeRestriction(person.id, existing.id);
              return;
            }
            addRestriction(person.id, {
              id: newId("r"),
              itemId: item.id,
              bucket: "cant_have",
              options:
                item.id === "tree_nut" || item.id === "peanut"
                  ? { sharedEquipment: "ask", coconutAsTreeNut: false }
                  : {},
            });
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title={`Remove ${person.name}?`}
        body={`This takes ${person.name} out of the household. Their rules go with them. You can add them again from setup.`}
        confirmLabel={`Delete ${person.name}`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deletePerson(person.id);
          setConfirmDelete(false);
          router.push("/prototype/people");
        }}
      />
    </div>
  );
}

function RestrictionEditor({
  restriction,
  personName,
  onChange,
  onClose,
}: {
  restriction: Restriction;
  personName: string;
  onChange: (restriction: Restriction) => void;
  onClose: () => void;
}) {
  const item = catalogById(restriction.itemId);
  const showShared = item?.advanced?.includes("sharedEquipment");
  const showCoconut = item?.advanced?.includes("coconutAsTreeNut");

  return (
    <div className="olp-stack-sm">
      <p className="olp-lead">
        How should OvenLovin treat this for {personName}? Plain language, same three lists as the
        profile.
      </p>
      <Segmented
        label="Severity"
        value={restriction.bucket}
        onChange={(bucket) => onChange({ ...restriction, bucket })}
        options={BUCKETS.map((bucket) => ({ value: bucket, label: bucketLabel(bucket) }))}
      />
      {showShared ? (
        <fieldset className="olp-fieldset">
          <legend>Avoid foods made where nuts are processed?</legend>
          <Segmented
            label="Shared equipment"
            value={restriction.options.sharedEquipment ?? "ask"}
            onChange={(sharedEquipment) =>
              onChange({
                ...restriction,
                options: { ...restriction.options, sharedEquipment },
              })
            }
            options={[
              { value: "yes", label: "Yes" },
              { value: "ask", label: "Ask me" },
              { value: "no", label: "No" },
            ]}
          />
        </fieldset>
      ) : null}
      {showCoconut ? (
        <fieldset className="olp-fieldset">
          <legend>Treat coconut as a tree nut?</legend>
          <Segmented
            label="Coconut"
            value={restriction.options.coconutAsTreeNut ? "yes" : "no"}
            onChange={(value) =>
              onChange({
                ...restriction,
                options: { ...restriction.options, coconutAsTreeNut: value === "yes" },
              })
            }
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </fieldset>
      ) : null}
      <button type="button" className="olp-btn olp-btn-primary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
