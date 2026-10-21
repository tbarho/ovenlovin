/* eslint-disable no-undef */
import { defineEval } from "eve/evals";
import { matches } from "eve/evals/expect";
import { z } from "zod";
import {
  IMPORT_EVAL_SCORE_GATE,
  resolveEvalModels,
  runImportCase,
  type CaseResult,
  type EvalCase,
} from "@ovenlovin/importers/eval";

const observedSchema = z.object({
  title: z.string().min(1),
  ingredients: z.array(z.string()).min(2),
  steps: z.array(z.string()).min(1),
});

function hasGatewayKey(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim());
}

export function defineImportJobEvals(cases: EvalCase[]) {
  const models = resolveEvalModels();
  return cases.flatMap((evalCase) =>
    models.map((model) =>
      defineEval({
        description: `${evalCase.job} ${evalCase.id} on ${model}`,
        tags: [evalCase.job, model],
        metadata: { job: evalCase.job, model, caseId: evalCase.id },
        timeoutMs: 180_000,
        async test(t) {
          if (!hasGatewayKey()) {
            t.skip("needs AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN");
          }
          let result: CaseResult;
          try {
            result = await runImportCase(model, evalCase);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            t.log(`${evalCase.job}/${evalCase.id} ${model} error=${message}`);
            throw error;
          }
          t.log(`${evalCase.job}/${evalCase.id} ${model} score=${result.scores.score.toFixed(3)}`);
          t.score(result.scores.title).label("title");
          t.score(result.scores.servings).label("servings");
          t.score(result.scores.ingredientRecall).label("ingredient-recall");
          t.score(result.scores.ingredientPrecision).label("ingredient-precision");
          t.score(result.scores.stepCompleteness).label("step-completeness");
          t.score({
            score: result.scores.score,
            metadata: {
              latencyMs: result.latencyMs,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUsd: result.costUsd,
              error: result.error,
              gateway: result.gateway,
            },
          })
            .label("import")
            .gate(IMPORT_EVAL_SCORE_GATE);
          t.check(
            {
              title: result.observed?.title ?? "",
              ingredients: result.observed?.ingredients ?? [],
              steps: result.observed?.steps ?? [],
            },
            matches(observedSchema)
          );
        },
      })
    )
  );
}
