export const AVATAR_COLORS = [
  "#e07a3d",
  "#c46a1b",
  "#c4473a",
  "#2f9e62",
  "#3d8bfd",
  "#7b6cff",
  "#db5a9a",
  "#161310",
] as const;

export const AVATAR_EMOJIS = [
  "🧑‍🍳",
  "👩",
  "👨",
  "👧",
  "👦",
  "👶",
  "🌻",
  "🌟",
  "🦋",
  "⚽️",
  "🏀",
  "🎨",
  "📚",
  "🎵",
  "🌈",
  "🐶",
  "🐱",
  "🦊",
  "🌙",
  "☀️",
  "🔥",
  "🍀",
  "🌸",
  "🍋",
] as const;

export type PersonAppearance = {
  emoji: string;
  color: string;
};

type StoredNotes = {
  ol: 1;
  emoji: string;
  color: string;
  text?: string;
};

function isStoredNotes(value: unknown): value is StoredNotes {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.ol === 1 &&
    typeof record.emoji === "string" &&
    record.emoji.length > 0 &&
    typeof record.color === "string" &&
    record.color.length > 0
  );
}

export function parsePersonNotes(notes: string | null | undefined): {
  appearance: Partial<PersonAppearance>;
  text: string;
} {
  if (!notes) return { appearance: {}, text: "" };
  try {
    const parsed: unknown = JSON.parse(notes);
    if (isStoredNotes(parsed)) {
      return {
        appearance: { emoji: parsed.emoji, color: parsed.color },
        text: typeof parsed.text === "string" ? parsed.text : "",
      };
    }
  } catch {
    /* plain-text notes from before avatars */
  }
  return { appearance: {}, text: notes };
}

export function writePersonNotes(appearance: PersonAppearance, text = ""): string {
  const payload: StoredNotes = {
    ol: 1,
    emoji: appearance.emoji,
    color: appearance.color,
  };
  if (text.trim()) payload.text = text.trim();
  return JSON.stringify(payload);
}

export function fallbackAppearance(personId: string): PersonAppearance {
  let hash = 0;
  for (const ch of personId) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return {
    emoji: AVATAR_EMOJIS[hash % AVATAR_EMOJIS.length] ?? "🧑‍🍳",
    color: AVATAR_COLORS[(hash >>> 8) % AVATAR_COLORS.length] ?? "#e07a3d",
  };
}

export function appearanceForPerson(person: {
  id: string;
  notes?: string | null;
}): PersonAppearance {
  const { appearance } = parsePersonNotes(person.notes);
  const fallback = fallbackAppearance(person.id);
  return {
    emoji: appearance.emoji ?? fallback.emoji,
    color: appearance.color ?? fallback.color,
  };
}
