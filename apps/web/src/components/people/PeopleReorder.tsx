"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Person } from "@ovenlovin/core";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { MOTION_SECONDS } from "@/lib/motion";
import {
  PEOPLE_REORDER_HINT_ID,
  movedLiveMessage,
  peopleReorderAnnouncements,
  peopleReorderInstructions,
} from "./people-reorder-a11y";

const MOTION_EASE_CSS = "cubic-bezier(0.2, 0.7, 0.2, 1)";

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5" cy="3.5" r="1.35" fill="currentColor" />
      <circle cx="11" cy="3.5" r="1.35" fill="currentColor" />
      <circle cx="5" cy="8" r="1.35" fill="currentColor" />
      <circle cx="11" cy="8" r="1.35" fill="currentColor" />
      <circle cx="5" cy="12.5" r="1.35" fill="currentColor" />
      <circle cx="11" cy="12.5" r="1.35" fill="currentColor" />
    </svg>
  );
}

function DragHandle({
  name,
  personId,
  disabled,
  listeners,
  attributes,
}: {
  name: string;
  personId?: string;
  disabled?: boolean;
  listeners?: object;
  attributes?: object;
}) {
  return (
    <button
      type="button"
      className="olp-drag-handle"
      data-testid={personId ? `people-drag-handle-${personId}` : undefined}
      aria-label={`Reorder ${name}`}
      aria-describedby={PEOPLE_REORDER_HINT_ID}
      disabled={disabled}
      style={{ minWidth: 44, minHeight: 44, cursor: "grab" }}
      {...attributes}
      {...listeners}
    >
      <GripIcon />
    </button>
  );
}

function PersonCardShell({
  person,
  renderPerson,
  handle,
}: {
  person: Person;
  renderPerson: (person: Person) => ReactNode;
  handle: ReactNode;
}) {
  return (
    <article className="olp-person-card" data-testid={`person-card-shell-${person.id}`}>
      {handle}
      {renderPerson(person)}
    </article>
  );
}

function SortablePerson({
  person,
  disabled,
  renderPerson,
}: {
  person: Person;
  disabled?: boolean;
  renderPerson: (person: Person) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: person.id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: reduce
      ? undefined
      : (transition ?? `transform ${MOTION_SECONDS.base}s ${MOTION_EASE_CSS}`),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`olp-person-slot${isDragging ? " is-dragging" : ""}`}
    >
      <PersonCardShell
        person={person}
        renderPerson={renderPerson}
        handle={
          <DragHandle
            name={person.displayName}
            personId={person.id}
            disabled={disabled}
            listeners={listeners}
            attributes={attributes}
          />
        }
      />
    </div>
  );
}

export function PeopleReorder({
  people,
  disabled,
  renderPerson,
  onReorder,
}: {
  people: Person[];
  disabled?: boolean;
  renderPerson: (person: Person) => ReactNode;
  onReorder: (personIds: string[]) => Promise<void>;
}) {
  const reduce = useReducedMotion();
  const [order, setOrder] = useState(people.map((person) => person.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | undefined>();
  const [liveMessage, setLiveMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(people.map((person) => person.id));
  }, [people]);

  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const orderedPeople = order
    .map((id) => byId.get(id))
    .filter((person): person is Person => Boolean(person));
  const activePerson = activeId ? (byId.get(activeId) ?? null) : null;
  const nameOf = (id: string) => byId.get(id)?.displayName ?? "Person";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function commit(next: string[]) {
    if (next.join() === people.map((person) => person.id).join()) return;
    setOrder(next);
    setError(null);
    try {
      await onReorder(next);
    } catch (err) {
      setOrder(people.map((person) => person.id));
      setError(err instanceof Error ? err.message : "Could not save order");
    }
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveId(id);
    const width = event.active.rect.current.initial?.width;
    setOverlayWidth(width);
    setLiveMessage(`Picked up ${nameOf(id)}.`);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from < 0 || to < 0 || from === to) return;
    const next = arrayMove(order, from, to);
    const person = byId.get(String(active.id));
    if (person) setLiveMessage(movedLiveMessage(person.displayName, to, next.length));
    void commit(next);
  }

  function onDragCancel() {
    if (activeId) setLiveMessage(`Cancelled reordering ${nameOf(activeId)}.`);
    setActiveId(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{
        announcements: peopleReorderAnnouncements(nameOf),
        screenReaderInstructions: peopleReorderInstructions,
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={order} strategy={rectSortingStrategy}>
        <div className="olp-person-row" data-testid="people-reorder">
          {orderedPeople.map((person) => (
            <SortablePerson
              key={person.id}
              person={person}
              disabled={disabled}
              renderPerson={renderPerson}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay
        dropAnimation={
          reduce ? null : { duration: MOTION_SECONDS.base * 1000, easing: MOTION_EASE_CSS }
        }
      >
        {activePerson ? (
          <div
            className="olp-person-ghost"
            data-testid="people-drag-overlay"
            style={{ width: overlayWidth }}
          >
            <PersonCardShell
              person={activePerson}
              renderPerson={renderPerson}
              handle={
                <DragHandle name={activePerson.displayName} personId={activePerson.id} disabled />
              }
            />
          </div>
        ) : null}
      </DragOverlay>
      <p id={PEOPLE_REORDER_HINT_ID} className="olp-sr">
        Drag the handle to reorder. Focus the handle, press Space to lift, then use the arrow keys
        to move.
      </p>
      <p className="olp-sr" role="status" aria-live="polite" data-testid="people-reorder-live">
        {liveMessage}
      </p>
      {error ? <p className="olp-muted">{error}</p> : null}
    </DndContext>
  );
}
