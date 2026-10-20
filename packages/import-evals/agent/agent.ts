import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

/**
 * Eval-only fixture agent so `eve eval` can boot.
 * Import scoring calls the AI SDK importers directly; this agent is not production.
 */
export default defineAgent({
  model: mockModel("OvenLovin import evals score the AI SDK importers, not this agent."),
});
