import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { generateObject } from "ai";
import { createPasteImporter } from "../importers/paste";
import { createPhotoImporter } from "../importers/photo";
import { extractRecipeWithLlm } from "../utils/llm-recipe";
import { pageTextFromHtml } from "../utils/page-text";
import { parseRecipeServings } from "../utils/recipe-ld";
import { type EvalCase, type EvalJob } from "./cases";
import { mean, median, scoreRecipe, type CaseScores, type ObservedRecipe } from "./score";

export type CaseResult = {
  job: EvalJob;
  id: string;
  model: string;
  scores: CaseScores;
  observed?: ObservedRecipe;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd: number | null;
  error?: string;
  gateway?: Record<string, unknown>;
};

export type JobSummary = {
  job: EvalJob;
  model: string;
  score: number;
  p50LatencyMs: number;
  costPerImportUsd: number | null;
  cases: number;
};

type UsageBag = {
  usage?: { inputTokens?: number; outputTokens?: number };
  providerMetadata?: Record<string, Record<string, unknown>>;
};

function costFromMeta(result: UsageBag): number | null {
  const gateway = result.providerMetadata?.gateway;
  const raw = gateway?.cost ?? gateway?.totalCost ?? gateway?.costUsd;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function trackingGenerate(): {
  generate: typeof generateObject;
  last: () => { usage: UsageBag; latencyMs: number };
} {
  let lastUsage: UsageBag = {};
  let lastMs = 0;
  const generate = (async (options: Parameters<typeof generateObject>[0]) => {
    const started = Date.now();
    const result = await generateObject(options);
    lastMs = Date.now() - started;
    lastUsage = result;
    return result;
  }) as typeof generateObject;
  return {
    generate,
    last: () => ({ usage: lastUsage, latencyMs: lastMs }),
  };
}

function fromDraft(draft: {
  title?: string;
  servings?: number;
  ingredients: Array<{ rawText: string; ingredient?: string }>;
  steps: Array<{ text: string }>;
}): ObservedRecipe {
  return {
    title: draft.title,
    servings: draft.servings,
    ingredients: draft.ingredients.map((item) => item.ingredient || item.rawText),
    steps: draft.steps.map((item) => item.text),
  };
}

function fromJsonLd(recipe: Record<string, unknown> | null): ObservedRecipe {
  if (!recipe) return { ingredients: [], steps: [] };
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

function imageDataUrl(imagePath: string, bytes: Buffer): string {
  const mime =
    imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg") ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export async function runImportCase(model: string, evalCase: EvalCase): Promise<CaseResult> {
  const tracker = trackingGenerate();
  const started = Date.now();
  let observed: ObservedRecipe;
  if (evalCase.job === "paste") {
    const importer = createPasteImporter({ modelId: model, generate: tracker.generate });
    const raw = await importer.extract({ text: evalCase.text ?? "" });
    observed = fromDraft(await importer.toDraft(raw));
  } else if (evalCase.job === "photo") {
    const bytes = readFileSync(evalCase.imagePath ?? "");
    const importer = createPhotoImporter({
      visionModelId: model,
      generate: tracker.generate,
    });
    const raw = await importer.extract({
      images: [{ blob: imageDataUrl(evalCase.imagePath ?? "", bytes) }],
      isHandwritten: evalCase.handwritten,
    });
    observed = fromDraft(await importer.toDraft(raw));
  } else {
    const recipe = await extractRecipeWithLlm(pageTextFromHtml(evalCase.html ?? ""), {
      modelId: model,
      generate: tracker.generate,
    });
    observed = fromJsonLd(recipe);
  }
  const tracked = tracker.last();
  return {
    job: evalCase.job,
    id: evalCase.id,
    model,
    observed,
    scores: scoreRecipe(observed, evalCase.expected),
    latencyMs: tracked.latencyMs || Date.now() - started,
    inputTokens: tracked.usage.usage?.inputTokens,
    outputTokens: tracked.usage.usage?.outputTokens,
    costUsd: costFromMeta(tracked.usage),
    gateway: tracked.usage.providerMetadata?.gateway,
  };
}

export function summarizeResults(results: CaseResult[]): JobSummary[] {
  const keys = new Map<string, CaseResult[]>();
  for (const result of results) {
    const key = `${result.job}::${result.model}`;
    const list = keys.get(key) ?? [];
    list.push(result);
    keys.set(key, list);
  }
  return [...keys.entries()].map(([, list]) => {
    const first = list[0];
    const costs = list.map((item) => item.costUsd).filter((item): item is number => item != null);
    return {
      job: first!.job,
      model: first!.model,
      score: mean(list.map((item) => item.scores.score)),
      p50LatencyMs: median(list.map((item) => item.latencyMs)),
      costPerImportUsd: costs.length === 0 ? null : mean(costs),
      cases: list.length,
    };
  });
}

export function formatSummaryTable(rows: JobSummary[]): string {
  const header = "| job | model | score | p50 latency | cost per import |";
  const rule = "| --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const score = row.score.toFixed(3);
    const latency = `${Math.round(row.p50LatencyMs)} ms`;
    const cost = row.costPerImportUsd == null ? "n/a" : `$${row.costPerImportUsd.toFixed(4)}`;
    return `| ${row.job} | ${row.model} | ${score} | ${latency} | ${cost} |`;
  });
  return [header, rule, ...body].join("\n");
}
