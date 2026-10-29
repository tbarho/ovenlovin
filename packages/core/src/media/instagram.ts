import { splitLeadingQuantity } from "../parsing/ingredient-line";
import { draftFromPlainText } from "../parsing/plain-import";
import type { RecipeImportDraft } from "../schemas/recipes";
import { canonicalInstagramPermalink, type InstagramPostKind } from "./source-url";

export type InstagramFailureCode =
  | "instagram_private"
  | "instagram_no_caption"
  | "instagram_blocked";

export type InstagramNextStepId = "paste" | "photo" | "link" | "retry" | "bio" | "type";

export type InstagramNextStep = {
  id: InstagramNextStepId;
  label: string;
  hint: string;
};

export type InstagramReadFailureCode =
  | "private"
  | "not_found"
  | "no_caption"
  | "blocked"
  | "unavailable";

const NO_AMOUNT_PREFIX = "no-amount:";

export function noAmountField(rawText: string): string {
  return `${NO_AMOUNT_PREFIX}${rawText}`;
}

export function isNoAmountField(field: string, rawText: string): boolean {
  return field === noAmountField(rawText);
}

export function ingredientHasAmount(rawText: string): boolean {
  return splitLeadingQuantity(rawText).min != null;
}

export function formatInstagramHandle(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "@") return "";
  const bare = trimmed.replace(/^@+/, "").trim();
  if (!bare) return "";
  return `@${bare}`;
}

export class InstagramImportError extends Error {
  readonly failureCode: InstagramFailureCode;
  readonly heading: string;
  readonly nextSteps: InstagramNextStep[];
  readonly permalink?: string;
  readonly handle?: string;
  readonly kind?: InstagramPostKind;

  constructor(input: {
    failureCode: InstagramFailureCode;
    heading: string;
    message: string;
    nextSteps: InstagramNextStep[];
    permalink?: string;
    handle?: string;
    kind?: InstagramPostKind;
  }) {
    super(input.message);
    this.name = "InstagramImportError";
    this.failureCode = input.failureCode;
    this.heading = input.heading;
    this.nextSteps = input.nextSteps;
    this.permalink = input.permalink;
    this.handle = input.handle;
    this.kind = input.kind;
  }
}

function kindLabel(kind: InstagramPostKind | undefined): string {
  return kind === "post" ? "post" : "Reel";
}

function creditName(handle: string | undefined): string {
  return formatInstagramHandle(handle) || "the creator";
}

export function instagramFailurePresentation(input: {
  code: InstagramReadFailureCode;
  handle?: string;
  kind?: InstagramPostKind;
  attempts?: number;
  permalink?: string;
}): InstagramImportError {
  const handle = formatInstagramHandle(input.handle);
  const who = creditName(handle);
  const kind = kindLabel(input.kind);
  const attempts = input.attempts ?? 1;
  const shared = {
    permalink: input.permalink,
    handle: handle || undefined,
    kind: input.kind,
  };

  if (input.code === "private") {
    return new InstagramImportError({
      ...shared,
      failureCode: "instagram_private",
      heading: "This account is private",
      message: `${who} only shares posts with followers, so OvenLovin cannot read it. Nothing was saved.`,
      nextSteps: [
        {
          id: "paste",
          label: "Paste the caption",
          hint: handle ? `We credit ${handle}.` : "We credit the creator.",
        },
        {
          id: "photo",
          label: "Screenshot it, use Photo import",
          hint: "Works for the caption and the dish.",
        },
        { id: "link", label: "Try a different link", hint: "" },
      ],
    });
  }

  if (input.code === "no_caption") {
    return new InstagramImportError({
      ...shared,
      failureCode: "instagram_no_caption",
      heading: "No recipe in the caption",
      message: `This ${kind}'s caption has no ingredients or steps. The recipe is probably spoken in the video, and v1 only reads captions. Nothing was saved.`,
      nextSteps: [
        {
          id: "bio",
          label: "Check the creator's recipe link",
          hint: "Many creators link the full recipe in their bio. Paste that link here.",
        },
        {
          id: "photo",
          label: "Screenshot the on-screen recipe",
          hint: "Photo import reads it.",
        },
        {
          id: "type",
          label: "Type it in",
          hint: `Starts a blank recipe credited to ${who}.`,
        },
      ],
    });
  }

  const stillBlocked = attempts > 1;
  return new InstagramImportError({
    ...shared,
    failureCode: "instagram_blocked",
    heading: stillBlocked
      ? "Instagram is still not letting us read it"
      : "Instagram did not let us read this post",
    message: stillBlocked
      ? "We tried twice. Nothing was saved."
      : "This happens sometimes and is not your link's fault. Nothing was saved.",
    nextSteps: [
      ...(stillBlocked
        ? []
        : [{ id: "retry" as const, label: "Try again", hint: "One more try usually works." }]),
      {
        id: "paste",
        label: "Paste the caption",
        hint: "Always works for public posts.",
      },
      { id: "photo", label: "Screenshot it, use Photo import", hint: "" },
    ],
  });
}

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F/gu;
const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
const SERVES_LINE = /^(?:serves|servings|yield|makes)\s*:?\s*(\d+)/i;
const STEP_LINE = /^\d+[.)]\s+(.+)$/;

export type ParsedInstagramCaption = {
  title: string;
  servings?: number;
  ingredients: Array<{ rawText: string; hasAmount: boolean }>;
  steps: string[];
};

export function cleanInstagramCaption(caption: string): string {
  return caption
    .replace(EMOJI, "")
    .replace(HASHTAG, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleFromFirstLine(line: string): string {
  const cut = line.split(/\s+(?:save this|follow)\b/i)[0] ?? line;
  return cut.replace(/[!|.]+$/g, "").trim() || line.trim();
}

/** Deterministic caption read. Hashtags and emoji are dropped before the lines are split. */
export function parseInstagramCaption(caption: string): ParsedInstagramCaption {
  const cleaned = cleanInstagramCaption(caption);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = titleFromFirstLine(lines[0] ?? "");
  let servings: number | undefined;
  const ingredients: ParsedInstagramCaption["ingredients"] = [];
  const steps: string[] = [];

  for (const line of lines.slice(1)) {
    const serves = line.match(SERVES_LINE);
    if (serves?.[1]) {
      const count = Number(serves[1]);
      if (count >= 1 && count <= 24) servings = count;
      continue;
    }
    const step = line.match(STEP_LINE);
    if (step?.[1]) {
      steps.push(step[1].trim());
      continue;
    }
    if (/^(ingredients?|steps?|instructions?|method|directions?)\s*:?\s*$/i.test(line)) continue;
    ingredients.push({ rawText: line, hasAmount: ingredientHasAmount(line) });
  }

  return { title: title || "Untitled recipe", servings, ingredients, steps };
}

export function instagramCaptionHasRecipe(parsed: ParsedInstagramCaption): boolean {
  return parsed.ingredients.length >= 2 || parsed.steps.length > 0;
}

export function instagramCaptionPlainText(parsed: ParsedInstagramCaption): string {
  return [
    parsed.title,
    parsed.servings ? `Serves ${parsed.servings}` : "",
    "Ingredients",
    ...parsed.ingredients.map((item) => item.rawText),
    "Steps",
    ...parsed.steps,
  ]
    .filter(Boolean)
    .join("\n");
}

export function withInstagramCredit(
  draft: RecipeImportDraft,
  input: {
    permalink?: string;
    handle?: string;
    kind?: InstagramPostKind;
    caption: string;
    coverUrl?: string;
    coverStorable?: boolean;
  }
): RecipeImportDraft {
  const handle = formatInstagramHandle(input.handle);
  const uncertain = new Set(draft.uncertainFields ?? []);
  for (const ingredient of draft.ingredients) {
    if (!ingredientHasAmount(ingredient.rawText)) uncertain.add(noAmountField(ingredient.rawText));
  }
  const images =
    input.coverStorable && input.coverUrl ? [input.coverUrl] : (draft.images ?? []);
  return {
    ...draft,
    images,
    needsReview: true,
    uncertainFields: [...uncertain],
    source: {
      ...draft.source,
      type: "social",
      url: input.permalink,
      canonicalUrl: input.permalink,
      author: handle || undefined,
      attribution: handle ? `${handle} on Instagram` : "Instagram",
      importerName: "instagram",
      importerVersion: "0.1.0",
      rawExtractionJson: {
        ...(draft.source.rawExtractionJson ?? {}),
        sourcePlatform: "instagram",
        sourceName: handle || undefined,
        kind: input.kind,
        caption: input.caption,
        coverStorable: Boolean(input.coverStorable && input.coverUrl),
      },
    },
  };
}

/** Caption text to a review draft. Throws InstagramImportError when it is not a recipe. */
export function draftFromInstagramCaption(input: {
  caption: string;
  permalink?: string;
  handle?: string;
  kind?: InstagramPostKind;
  coverUrl?: string;
  coverStorable?: boolean;
}): RecipeImportDraft {
  const parsed = parseInstagramCaption(input.caption);
  const instagram = input.permalink ? canonicalInstagramPermalink(input.permalink) : null;
  const credit = {
    permalink: instagram?.permalink ?? input.permalink,
    handle: input.handle,
    kind: input.kind ?? instagram?.kind,
    caption: input.caption,
    coverUrl: input.coverUrl,
    coverStorable: input.coverStorable,
  };
  if (!instagramCaptionHasRecipe(parsed)) {
    throw instagramFailurePresentation({
      code: "no_caption",
      handle: input.handle,
      kind: credit.kind,
      permalink: credit.permalink,
    });
  }
  const draft = draftFromPlainText(instagramCaptionPlainText(parsed));
  if (parsed.servings) draft.servings = parsed.servings;
  return withInstagramCredit(draft, credit);
}

export function blankInstagramDraft(input: {
  permalink?: string;
  handle?: string;
  kind?: InstagramPostKind;
}): RecipeImportDraft {
  const instagram = input.permalink ? canonicalInstagramPermalink(input.permalink) : null;
  const handle = formatInstagramHandle(input.handle);
  return {
    title: "Untitled recipe",
    servings: 2,
    ingredients: [],
    steps: [],
    needsReview: true,
    uncertainFields: [],
    source: {
      type: "social",
      url: instagram?.permalink ?? input.permalink,
      canonicalUrl: instagram?.permalink ?? input.permalink,
      author: handle || undefined,
      attribution: handle ? `${handle} on Instagram` : "Instagram",
      importerName: "instagram",
      importerVersion: "0.1.0",
      rawExtractionJson: {
        sourcePlatform: "instagram",
        sourceName: handle || undefined,
        kind: input.kind ?? instagram?.kind,
        caption: "",
        typedIn: true,
      },
    },
  };
}
