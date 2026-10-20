import { defineEvalConfig } from "eve/evals";
import { importSummaryReporter } from "./import-summary-reporter";

export default defineEvalConfig({
  timeoutMs: 180_000,
  maxConcurrency: 2,
  reporters: [importSummaryReporter()],
});
