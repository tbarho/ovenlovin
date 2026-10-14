"use client";

import type { Person } from "@ovenlovin/core";
import { movePersonId } from "@ovenlovin/core/people-order";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

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
  const [order, setOrder] = useState(people.map((person) => person.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const drag = useRef<{ id: string; pointerId: number } | null>(null);
  const orderRef = useRef(order);

  useEffect(() => {
    setOrder(people.map((person) => person.id));
  }, [people]);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const byId = new Map(people.map((person) => [person.id, person]));
  const orderedPeople = order
    .map((id) => byId.get(id))
    .filter((person): person is Person => Boolean(person));

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

  function move(id: string, delta: number) {
    if (disabled) return;
    void commit(movePersonId(order, id, delta));
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId };
    setDraggingId(id);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const overId = hitPersonId(itemRefs.current, event.clientX, event.clientY);
    if (!overId || overId === drag.current.id) return;
    setOrder((current) => {
      const from = current.indexOf(drag.current!.id);
      const to = current.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return current;
      return movePersonId(current, drag.current!.id, to - from);
    });
  }

  function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const next = orderRef.current;
    drag.current = null;
    setDraggingId(null);
    void commit(next);
  }

  return (
    <div className="olp-person-row" data-testid="people-reorder">
      {orderedPeople.map((person, index) => (
        <article
          key={person.id}
          className={`olp-person-slot${draggingId === person.id ? " is-dragging" : ""}`}
          ref={(node) => {
            if (node) itemRefs.current.set(person.id, node);
            else itemRefs.current.delete(person.id);
          }}
        >
          <div className="olp-person-tools">
            <button
              type="button"
              className="olp-drag-handle"
              aria-label={`Reorder ${person.displayName}`}
              aria-describedby="people-reorder-hint"
              disabled={disabled}
              onPointerDown={(event) => onPointerDown(event, person.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={(event) => {
                if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  move(person.id, -1);
                }
                if (event.key === "ArrowDown" || event.key === "ArrowRight") {
                  event.preventDefault();
                  move(person.id, 1);
                }
              }}
            >
              <span aria-hidden="true">⋮⋮</span>
            </button>
            <div className="olp-move-keys">
              <button
                type="button"
                className="olp-move-btn"
                aria-label={`Move ${person.displayName} up`}
                disabled={disabled || index === 0}
                onClick={() => move(person.id, -1)}
              >
                Up
              </button>
              <button
                type="button"
                className="olp-move-btn"
                aria-label={`Move ${person.displayName} down`}
                disabled={disabled || index === orderedPeople.length - 1}
                onClick={() => move(person.id, 1)}
              >
                Down
              </button>
            </div>
          </div>
          {renderPerson(person)}
        </article>
      ))}
      <p id="people-reorder-hint" className="olp-sr">
        Drag the handle to reorder, or use the Up and Down buttons. Arrow keys also move the focused
        handle.
      </p>
      {error ? <p className="olp-muted">{error}</p> : null}
    </div>
  );
}

function hitPersonId(nodes: Map<string, HTMLElement>, x: number, y: number): string | null {
  for (const [id, node] of nodes) {
    const box = node.getBoundingClientRect();
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return id;
    }
  }
  return null;
}
