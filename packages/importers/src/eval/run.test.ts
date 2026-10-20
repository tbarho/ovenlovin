import { describe, expect, it } from "vitest";
import { formatSummaryTable, summarizeResults, type CaseResult } from "./run";

function result(partial: Partial<CaseResult>): CaseResult {
  return {
    job: "paste",
    id: "x",
    model: "deepseek/deepseek-v4.1-flash",
    scores: {
      title: 1,
      servings: 1,
      ingredientRecall: 1,
      ingredientPrecision: 1,
      stepCompleteness: 1,
      validStructured: 1,
      score: 1,
    },
    latencyMs: 100,
    costUsd: null,
    ...partial,
  };
}

describe("summarizeResults", () => {
  it("averages scores and leaves cost n/a when the gateway omits it", () => {
    const rows = summarizeResults([
      result({ latencyMs: 80, scores: { ...result({}).scores, score: 0.8 } }),
      result({ id: "y", latencyMs: 120, scores: { ...result({}).scores, score: 1 } }),
    ]);
    expect(rows[0]).toMatchObject({
      job: "paste",
      model: "deepseek/deepseek-v4.1-flash",
      score: 0.9,
      p50LatencyMs: 100,
      costPerImportUsd: null,
      cases: 2,
    });
    expect(formatSummaryTable(rows)).toContain(
      "| paste | deepseek/deepseek-v4.1-flash | 0.900 | 100 ms | n/a |"
    );
  });
});
