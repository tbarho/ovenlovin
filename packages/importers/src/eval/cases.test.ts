import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRecipeServings } from "../utils/recipe-ld";
import { ALL_CASES, PHOTO_CASES, PASTE_CASES, URL_CASES, resolveEvalModels } from "./cases";
import {
  IMPORT_EVAL_SCORE_GATE,
  scoreRecipe,
  type ExpectedRecipe,
  type ObservedRecipe,
} from "./score";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

type GoldenExtraction = {
  draft?: {
    title?: string;
    servings?: number | null;
    ingredients?: Array<{ rawText?: string }>;
    steps?: Array<{ text?: string }>;
  };
  recipe?: Record<string, unknown>;
};

type GoldenFile = {
  extractions: Record<string, Record<string, GoldenExtraction>>;
};

type Label = { correct: boolean };
type LabelsFile = { labels: Record<string, Record<string, Label>> };
type KeysFile = { cases: Record<string, ExpectedRecipe> };

const goldens = JSON.parse(
  readFileSync(join(fixtures, "golden-extractions.json"), "utf8")
) as GoldenFile;
const labels = JSON.parse(readFileSync(join(fixtures, "human-labels.json"), "utf8")) as LabelsFile;
const keys = JSON.parse(readFileSync(join(fixtures, "answer-keys.json"), "utf8")) as KeysFile;

function observedFromGolden(extraction: GoldenExtraction): ObservedRecipe {
  if (extraction.draft) {
    return {
      title: extraction.draft.title,
      servings: extraction.draft.servings ?? undefined,
      ingredients: (extraction.draft.ingredients ?? []).map((item) => item.rawText ?? ""),
      steps: (extraction.draft.steps ?? []).map((item) => item.text ?? ""),
    };
  }
  const recipe = extraction.recipe ?? {};
  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient.map((item) => String(item))
    : [];
  const steps = Array.isArray(recipe.recipeInstructions)
    ? recipe.recipeInstructions.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) return String(item.text);
        return String(item);
      })
    : [];
  return {
    title: typeof recipe.name === "string" ? recipe.name : undefined,
    servings: parseRecipeServings(recipe),
    ingredients,
    steps,
  };
}

describe("import eval fixtures", () => {
  it("keeps eight cases per job", () => {
    expect(PASTE_CASES).toHaveLength(8);
    expect(PHOTO_CASES).toHaveLength(8);
    expect(URL_CASES).toHaveLength(8);
  });

  it("uses real saved recipe HTML without JSON-LD", () => {
    for (const item of URL_CASES) {
      expect(item.html && item.html.length, item.id).toBeGreaterThan(20_000);
      expect(item.html, item.id).not.toMatch(/application\/ld\+json/i);
      expect(item.html, item.id).toMatch(/<nav\b|main menu|skip to|comment|mw-/i);
    }
  });

  it("has real JPEG photo files on disk", () => {
    for (const item of PHOTO_CASES) {
      expect(item.imagePath && existsSync(item.imagePath), item.id).toBe(true);
      expect(item.imagePath?.endsWith(".jpg"), item.id).toBe(true);
      expect(statSync(item.imagePath!).size, item.id).toBeGreaterThan(10_000);
    }
    expect(
      PHOTO_CASES.some((item) => item.id === "handwritten-ginger-snaps" && item.handwritten)
    ).toBe(true);
    expect(PHOTO_CASES.some((item) => item.id === "weeknight-chili")).toBe(true);
  });

  it("loads a hand key for every case", () => {
    for (const item of ALL_CASES) {
      expect(item.expected.ingredients.length, `${item.job}/${item.id}`).toBeGreaterThan(0);
      expect(item.expected.ingredients.every((ing) => ing.food.length > 0)).toBe(true);
    }
  });

  it("honors EVAL_IMPORT_MODEL", () => {
    expect(resolveEvalModels({ EVAL_IMPORT_MODEL: "openai/gpt-6-luna" })).toEqual([
      "openai/gpt-6-luna",
    ]);
  });
});

describe("hand-key agreement", () => {
  it("scores every human-correct golden at or above the gate", () => {
    let n = 0;
    for (const [caseId, models] of Object.entries(labels.labels)) {
      const expected = keys.cases[caseId];
      expect(expected, caseId).toBeDefined();
      for (const [model, label] of Object.entries(models)) {
        if (!label.correct) continue;
        const extraction = goldens.extractions[caseId]?.[model];
        expect(extraction, `${caseId} ${model}`).toBeDefined();
        const scores = scoreRecipe(observedFromGolden(extraction!), expected!);
        expect(scores.score, `${caseId} ${model} ${JSON.stringify(scores)}`).toBeGreaterThanOrEqual(
          IMPORT_EVAL_SCORE_GATE
        );
        n += 1;
      }
    }
    expect(n).toBe(72);
  });
});

describe("hand-key negatives", () => {
  const expected = keys.cases["paste/banana-bread"]!;
  const banana = observedFromGolden(
    goldens.extractions["paste/banana-bread"]!["deepseek/deepseek-v4.1-flash"]!
  );

  it("dropping one ingredient scores below the gate", () => {
    const scores = scoreRecipe({ ...banana, ingredients: banana.ingredients.slice(1) }, expected);
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });

  it("inventing one ingredient scores below the gate", () => {
    const scores = scoreRecipe(
      { ...banana, ingredients: [...banana.ingredients, "1 cup mystery spice"] },
      expected
    );
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });

  it("replacing sugar with brown sugar scores below the gate", () => {
    const scores = scoreRecipe(
      {
        ...banana,
        ingredients: banana.ingredients.map((line) =>
          line === "3/4 cup sugar" ? "3/4 cup brown sugar" : line
        ),
      },
      expected
    );
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });

  it("dropping half the steps scores below the gate", () => {
    const scores = scoreRecipe(
      { ...banana, steps: banana.steps.slice(0, Math.floor(banana.steps.length / 2)) },
      expected
    );
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });

  it("an empty recipe scores below the gate", () => {
    const scores = scoreRecipe({ ingredients: [], steps: [] }, expected);
    expect(scores.score).toBeLessThan(IMPORT_EVAL_SCORE_GATE);
  });
});
