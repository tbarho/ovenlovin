import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";

export const PEOPLE_REORDER_HINT_ID = "people-reorder-hint";

export const peopleReorderInstructions: ScreenReaderInstructions = {
  draggable:
    "To pick up a person, press Space or Enter. Then use the arrow keys to move, and Space or Enter to drop. Escape cancels.",
};

export function peopleReorderAnnouncements(nameOf: (id: string) => string): Announcements {
  return {
    onDragStart({ active }) {
      return `Picked up ${nameOf(String(active.id))}.`;
    },
    onDragOver({ active, over }) {
      if (!over) return;
      if (active.id === over.id) return;
      return `${nameOf(String(active.id))} is over ${nameOf(String(over.id))}.`;
    },
    onDragEnd({ active, over }) {
      if (!over || active.id === over.id) {
        return `Dropped ${nameOf(String(active.id))}. Position unchanged.`;
      }
      return `Moved ${nameOf(String(active.id))}.`;
    },
    onDragCancel({ active }) {
      return `Cancelled reordering ${nameOf(String(active.id))}.`;
    },
  };
}

export function movedLiveMessage(name: string, index: number, count: number): string {
  return `Moved ${name}. Now ${index + 1} of ${count}.`;
}
