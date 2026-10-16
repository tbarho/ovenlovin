import { z } from "zod";
import type { AuthContext } from "../auth/index";
import { PeopleService, resolveWriteActor } from "@ovenlovin/core";
import { canonicalizePersonRuleTarget, unknownRuleTargetMessage } from "@ovenlovin/allergens";
import { createDbClient } from "@ovenlovin/db";

export { canonicalizePersonRuleTarget } from "@ovenlovin/allergens";

export const managePersonRulesSchema = z.object({
  action: z.enum(["list", "add", "remove"]),
  personId: z.string().uuid(),
  id: z.string().uuid().optional().describe("Rule id (required for remove)"),
  kind: z
    .enum(["allergen", "ingredient", "ingredient_category", "diet", "tag", "custom"])
    .optional(),
  target: z.string().min(1).max(255).optional(),
  severity: z.enum(["block", "warn", "prefer_avoid"]).optional(),
  label: z.string().optional(),
  note: z.string().optional(),
  includeMayContain: z.boolean().optional(),
  includeCrossContact: z.boolean().optional(),
  sharedFacility: z.enum(["block", "warn", "ignore"]).optional(),
  includeDescendants: z.boolean().optional(),
  treatCoconutAsTreeNut: z
    .boolean()
    .optional()
    .describe("For tree_nut rules. Defaults to false - coconut is not a tree nut unless set."),
  confirmUnknown: z
    .boolean()
    .optional()
    .describe("Required to save a target that is not in the allergen catalog, such as xyzzy."),
});

async function handler(input: z.infer<typeof managePersonRulesSchema>, context: AuthContext) {
  const db = createDbClient(process.env.DATABASE_URL!);
  const people = new PeopleService(db);
  const person = await people.getPerson(input.personId);
  if (!person || person.householdId !== context.householdId) {
    throw new Error(`Person not found: ${input.personId}`);
  }

  if (input.action === "list") {
    const rules = await people.getRulesForPerson(person.id);
    return {
      personId: person.id,
      displayName: person.displayName,
      rules: rules.map((rule) => ({
        id: rule.id,
        kind: rule.kind,
        target: rule.target,
        severity: rule.severity,
        label: rule.label ?? undefined,
        note: rule.note ?? undefined,
      })),
    };
  }

  const actor = resolveWriteActor({
    userId: context.userId,
    apiKeyId: context.apiKeyId,
    apiKeyCreatedBy: context.apiKeyCreatedBy,
  });

  if (input.action === "add") {
    if (!input.kind || !input.target || !input.severity) {
      throw new Error("kind, target, and severity are required to add a rule");
    }
    const canonical = canonicalizePersonRuleTarget(input.kind, input.target);
    if (input.kind === "allergen" && !canonical.resolved && !input.confirmUnknown) {
      throw new Error(unknownRuleTargetMessage(input.target));
    }
    const created = await people.createRule({
      personId: person.id,
      kind: canonical.kind,
      target: canonical.target,
      severity: input.severity,
      includeMayContain: input.includeMayContain ?? input.severity === "block",
      includeCrossContact: input.includeCrossContact ?? input.severity === "block",
      sharedFacility: input.sharedFacility ?? (input.severity === "block" ? "block" : "ignore"),
      includeUnmappedIngredients: false,
      includeDescendants: input.includeDescendants ?? true,
      treatCoconutAsTreeNut: input.treatCoconutAsTreeNut ?? false,
      label: input.label ?? null,
      note: input.note ?? null,
      setBy: actor.setBy,
      createdBy: actor.createdBy,
      createdByApiKeyId: actor.createdByApiKeyId,
    });
    return {
      personId: person.id,
      status: "added" as const,
      rule: {
        id: created.id,
        kind: created.kind,
        target: created.target,
        severity: created.severity,
      },
      canonicalizedFrom: canonical.canonicalized ? input.target : undefined,
    };
  }

  if (!input.id) throw new Error("id is required to remove a rule");
  const existing = await people.getRule(input.id);
  if (!existing || existing.personId !== person.id) {
    throw new Error(`Rule not found: ${input.id}`);
  }
  await people.deleteRule(input.id);
  return { personId: person.id, status: "removed" as const, id: input.id };
}

export const managePersonRulesTool = {
  name: "manage_person_rules",
  description:
    "List, add, or remove Can't eat / Doesn't like rules for a person. Allergen typos (pean → peanut) are canonicalized the same way as the People UI. Not medical advice - always check ingredient labels before serving.",
  inputSchema: managePersonRulesSchema,
  handler,
} as const;
