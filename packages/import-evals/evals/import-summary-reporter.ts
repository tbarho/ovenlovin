import type { EvalReporter } from "eve/evals/reporters";
import { formatSummaryTable, summarizeResults, type CaseResult } from "@ovenlovin/importers/eval";

function numberMeta(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function importSummaryReporter(): EvalReporter {
  const results: CaseResult[] = [];

  return {
    onRunStart() {
      results.length = 0;
    },
    onEvalComplete(result, context) {
      if (result.verdict === "skipped") return;
      const meta = context?.evaluation.metadata ?? {};
      const scored = result.assertions.find((item) => item.key === "import");
      const scoredMeta = scored?.metadata ?? {};
      const job = typeof meta.job === "string" ? meta.job : "paste";
      const model = typeof meta.model === "string" ? meta.model : "unknown";
      const id = typeof meta.caseId === "string" ? meta.caseId : result.id;
      if (job !== "paste" && job !== "photo" && job !== "url") return;
      results.push({
        job,
        id,
        model,
        scores: {
          title: result.assertions.find((item) => item.key === "title")?.score ?? 0,
          servings: result.assertions.find((item) => item.key === "servings")?.score ?? 0,
          ingredientRecall:
            result.assertions.find((item) => item.key === "ingredient-recall")?.score ?? 0,
          ingredientPrecision:
            result.assertions.find((item) => item.key === "ingredient-precision")?.score ?? 0,
          stepCompleteness:
            result.assertions.find((item) => item.key === "step-completeness")?.score ?? 0,
          score: scored?.score ?? 0,
        },
        latencyMs: numberMeta(scoredMeta.latencyMs) ?? 0,
        inputTokens: numberMeta(scoredMeta.inputTokens),
        outputTokens: numberMeta(scoredMeta.outputTokens),
        costUsd: numberMeta(scoredMeta.costUsd) ?? null,
        error: result.error,
      });
    },
    onRunComplete() {
      if (results.length === 0) return;
      console.log(`\n${formatSummaryTable(summarizeResults(results))}\n`);
    },
  };
}
