/* eslint-disable no-undef */
import { describe, expect, it } from "vitest";
import { ALL_CASES, resolveEvalModels } from "./cases";
import { formatSummaryTable, runImportEval, summarizeResults } from "./run";

const models = resolveEvalModels();

describe("import live-model eval", () => {
  it(
    `scores ${models.join(", ")} on paste, photo, and URL extract`,
    async () => {
      const results = await runImportEval(models, ALL_CASES);
      const summary = summarizeResults(results);
      const table = formatSummaryTable(summary);
      console.log(`\n${table}\n`);
      expect(summary.length).toBe(models.length * 3);
      expect(results).toHaveLength(models.length * ALL_CASES.length);
    },
    40 * 60 * 1000
  );
});
