"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import { tapFeedback } from "./haptics";
import {
  bucketHint,
  bucketLabel,
  catalogById,
  defaultBucketForItem,
  defaultOptionsForItem,
  newId,
  personTheme,
  restrictionLabel,
  type Bucket,
  type Restriction,
} from "./model";
import { FoodPicker } from "./FoodPicker";
import { usePrototype } from "./store";
import { Avatar, Chip, ConfirmSheet, EmptyState, Segmented, SeverityLanes, Sheet } from "./ui";

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

  const theme = personTheme(person.color);

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
      <header
        className="olp-person-theme"
        style={
          {
            "--olp-theme-wash": theme.wash,
            "--olp-theme-glow": theme.glow,
          } as CSSProperties
        }
      >
        <Avatar person={person} size={84} />
        <div className="olp-person-head">
          <p className="olp-kicker">{person.generation === "kid" ? "Kid" : "Adult"}</p>
          <h1>{person.name}</h1>
          <p className="olp-muted">
            A food passport. Drag a chip between lanes, or tap to fine-tune.
          </p>
        </div>
      </header>

      <LayoutGroup>
        {BUCKETS.map((bucket) => (
          <section
            key={bucket}
            className={`olp-lane olp-lane-${bucket}${dropBucket === bucket ? " is-drop" : ""}`}
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
                <AnimatePresence initial={false}>
                  {grouped[bucket].map((restriction) => (
                    <Chip
                      key={restriction.id}
                      label={restrictionLabel(restriction)}
                      itemId={restriction.itemId}
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
                </AnimatePresence>
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
        onClose={closeEditing}
      >
        {editing ? (
          <RestrictionEditor
            key={editing.id}
            restriction={editing}
            personName={person.name}
            onChange={(next) => {
              updateRestriction(person.id, next);
              setEditing(next);
            }}
            onClose={closeEditing}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={adding}
        title={`Anything ${person.name} can’t or won’t eat?`}
        onClose={closeAdding}
      >
        <FoodPicker
          key="add-food-picker"
          selectedIds={person.restrictions.map((item) => item.itemId)}
          caption="Tap a tile, or type it in plain language. Allergens default to Can’t have."
          onToggle={(item) => {
            const existing = person.restrictions.find((entry) => entry.itemId === item.id);
            if (existing) {
              removeRestriction(person.id, existing.id);
              return;
            }
            tapFeedback();
            addRestriction(person.id, {
              id: newId("r"),
              itemId: item.id,
              bucket: defaultBucketForItem(item),
              options: defaultOptionsForItem(item),
            });
          }}
          onAddParsed={(item, bucket) => {
            addRestriction(person.id, {
              id: newId("r"),
              itemId: item.id,
              bucket,
              options: defaultOptionsForItem(item),
            });
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title={`Remove ${person.name}?`}
        body={`This takes ${person.name} out of the household. Their rules go with them. You can add them again from setup.`}
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
        How should OvenLovin treat this for {personName}? Slide between the three lanes — same
        meaning as the passport.
      </p>
      <SeverityLanes
        value={restriction.bucket}
        personName={personName}
        onChange={(bucket) => onChange({ ...restriction, bucket })}
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
