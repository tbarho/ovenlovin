import type { RecipeImportDraft } from "../schemas/recipes";

const INGREDIENT_HEADER = /^(ingredients?|what you need)\s*:?\s*$/i;
const STEP_HEADER = /^(steps?|instructions?|method|directions?|preparation)\s*:?\s*$/i;
const NOTES_HEADER = /^(notes?|note|tips?|cook(?:'?s)? notes?)\s*:?\s*$/i;
const SERVINGS_LINE = /^(?:servings?|serves|yield|makes)\s*:?\s*(.+)$/i;
const TIME_LINE = /^(prep|cook|total)(?:\s*time)?\s*:?\s*(.+)$/i;
const INLINE_NOTES = /^(?:notes?|note|tips?)\s*:\s+(.+)$/i;
const SOURCE_LINE = /^source\s*:\s*(.+)$/i;

function firstPositiveInt(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match?.[1]) return undefined;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.round(n);
}

export function parseMinutesFromText(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const iso = trimmed.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (iso) {
    const hours = Number(iso[1] ?? 0);
    const minutes = Number(iso[2] ?? 0);
    const total = hours * 60 + minutes;
    return total > 0 ? total : undefined;
  }

  let minutes = 0;
  const hours = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const mins = trimmed.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i);
  if (hours?.[1]) minutes += Math.round(Number(hours[1]) * 60);
  if (mins?.[1]) minutes += Math.round(Number(mins[1]));
  if (minutes > 0) return minutes;

  return firstPositiveInt(trimmed);
}

type PasteMeta = {
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  notes?: string;
  sourceUrl?: string;
  sourceName?: string;
};

export function stripLeadingStepNumber(text: string): string {
  return text.replace(/^\s*(?:\d+|[A-Za-z]|[ivxlcdm]+)[.)]\s+/i, "").trim();
}

function parseSourceValue(value: string): { sourceUrl?: string; sourceName?: string } {
  const trimmed = value.trim();
  if (!trimmed) return {};
  try {
    const url = new globalThis.URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return { sourceUrl: url.toString() };
    }
  } catch {
    // not a URL
  }
  return { sourceName: trimmed };
}

function applyTime(meta: PasteMeta, kind: string, minutes: number | undefined): void {
  if (minutes == null) return;
  if (kind === "prep") meta.prepTimeMinutes = minutes;
  else if (kind === "cook") meta.cookTimeMinutes = minutes;
  else meta.totalTimeMinutes = minutes;
}

function appendNotes(meta: PasteMeta, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  meta.notes = meta.notes ? `${meta.notes}\n${trimmed}` : trimmed;
}

/**
 * Pull labeled servings, times, and notes out of pasted recipe text so they
 * are not treated as ingredients or steps.
 */
export function extractPasteMetadata(lines: string[]): { kept: string[]; meta: PasteMeta } {
  const kept: string[] = [];
  const meta: PasteMeta = {};
  let inNotes = false;

  for (const line of lines) {
    if (NOTES_HEADER.test(line)) {
      inNotes = true;
      continue;
    }
    if (INGREDIENT_HEADER.test(line) || STEP_HEADER.test(line)) {
      inNotes = false;
      kept.push(line);
      continue;
    }

    if (inNotes) {
      appendNotes(meta, line);
      continue;
    }

    const servingsMatch = line.match(SERVINGS_LINE);
    if (servingsMatch?.[1]) {
      const servings = firstPositiveInt(servingsMatch[1]);
      if (servings != null) {
        meta.servings = servings;
        continue;
      }
    }

    const timeMatch = line.match(TIME_LINE);
    if (timeMatch?.[1] && timeMatch[2]) {
      const minutes = parseMinutesFromText(timeMatch[2]);
      if (minutes != null) {
        applyTime(meta, timeMatch[1].toLowerCase(), minutes);
        continue;
      }
    }

    const notesMatch = line.match(INLINE_NOTES);
    if (notesMatch?.[1]) {
      appendNotes(meta, notesMatch[1]);
      continue;
    }

    const sourceMatch = line.match(SOURCE_LINE);
    if (sourceMatch?.[1]) {
      const parsed = parseSourceValue(sourceMatch[1]);
      if (parsed.sourceUrl) meta.sourceUrl = parsed.sourceUrl;
      if (parsed.sourceName) meta.sourceName = parsed.sourceName;
      continue;
    }

    kept.push(line);
  }

  if (
    meta.totalTimeMinutes == null &&
    (meta.prepTimeMinutes != null || meta.cookTimeMinutes != null)
  ) {
    meta.totalTimeMinutes = (meta.prepTimeMinutes ?? 0) + (meta.cookTimeMinutes ?? 0);
  }

  return { kept, meta };
}

/** Deterministic paste fallback when AI Gateway is off (including public demo). */
export function draftFromPlainText(text: string): RecipeImportDraft {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines[0] ?? "Untitled recipe";
  const { kept, meta } = extractPasteMetadata(lines.slice(1));
  const rest = kept;

  const ingredientStart = rest.findIndex((line) => INGREDIENT_HEADER.test(line));
  const stepStart = rest.findIndex((line) => STEP_HEADER.test(line));

  let ingredientLines: string[] = [];
  let stepLines: string[] = [];

  if (ingredientStart >= 0 && stepStart > ingredientStart) {
    ingredientLines = rest.slice(ingredientStart + 1, stepStart);
    stepLines = rest.slice(stepStart + 1);
  } else {
    ingredientLines = rest.filter((line) => line.length < 80);
    stepLines = rest.filter((line) => line.length >= 80);
    if (stepLines.length === 0) {
      stepLines = rest.slice(Math.ceil(rest.length / 2));
      ingredientLines = rest.slice(0, Math.ceil(rest.length / 2));
    }
  }

  const firstRest = rest[0];
  const description =
    firstRest &&
    firstRest !== title &&
    !INGREDIENT_HEADER.test(firstRest) &&
    !STEP_HEADER.test(firstRest)
      ? firstRest
      : undefined;

  return {
    title,
    description,
    notes: meta.notes,
    servings: meta.servings,
    prepTimeMinutes: meta.prepTimeMinutes,
    cookTimeMinutes: meta.cookTimeMinutes,
    totalTimeMinutes: meta.totalTimeMinutes,
    ingredients: ingredientLines.map((rawText) => ({ rawText, confidence: 0.5 })),
    steps: stepLines.map((stepText, order) => ({
      text: stripLeadingStepNumber(stepText),
      order,
    })),
    source: {
      type: "paste",
      url: meta.sourceUrl,
      attribution: meta.sourceName,
      importerName: "plain-paste",
      importerVersion: "0.1.0",
      rawExtractionJson: { text },
    },
    needsReview: true,
  };
}
