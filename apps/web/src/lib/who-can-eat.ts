import {
  checkIngredientsAgainstRules,
  collapseRuleFindings,
  formatPlainFinding,
  sanitizeWarningCopy,
  type IngredientCheckInput,
  type RuleCheckFinding,
  type RuleCheckResult,
} from "@ovenlovin/allergens";
import type { Person, PersonRule } from "@ovenlovin/core";
import { parseIngredientLine } from "@ovenlovin/core/parsing";
import type { EatMark } from "@/components/people/ui";

export type WhoCanEatPerson = {
  personId: string;
  personName: string;
  mark: EatMark;
  title: string;
  reasons: string[];
};

export type WhoCanEatResult = {
  status: RuleCheckResult["status"];
  incompleteReasons: string[];
  people: WhoCanEatPerson[];
};

export type CheckableIngredient = {
  id: string;
  name: string;
  substitutionNotes?: string | null;
};

export function ingredientsForCheck(
  ingredients: CheckableIngredient[],
  appliedSwapIds: Iterable<string>
): IngredientCheckInput[] {
  const applied = new Set(appliedSwapIds);
  return ingredients.map((ingredient) => {
    const raw =
      applied.has(ingredient.id) && ingredient.substitutionNotes?.trim()
        ? ingredient.substitutionNotes.trim()
        : ingredient.name;
    const parsed = parseIngredientLine(raw).name;
    return { name: parsed || raw };
  });
}

export function swapsForIngredients(ingredients: CheckableIngredient[]): CheckableIngredient[] {
  return ingredients.filter((ingredient) => Boolean(ingredient.substitutionNotes?.trim()));
}

function worstMark(findings: RuleCheckFinding[]): EatMark {
  if (findings.some((finding) => finding.severity === "block")) return "block";
  if (findings.some((finding) => finding.severity === "warn")) return "warn";
  if (findings.some((finding) => finding.severity === "prefer_avoid")) return "warn";
  return "ok";
}

function titleFor(personName: string, mark: EatMark): string {
  if (mark === "block") return `${personName} can't eat this`;
  if (mark === "warn") return `Check with ${personName} first`;
  return `${personName} can eat this`;
}

function reasonForFinding(finding: RuleCheckFinding): string {
  const plain = formatPlainFinding(finding);
  return sanitizeWarningCopy(plain);
}

export function whoCanEat(opts: {
  people: Person[];
  rules: PersonRule[];
  ingredients: CheckableIngredient[];
  appliedSwapIds?: Iterable<string>;
}): WhoCanEatResult {
  const contexts = opts.rules.map((rule) => {
    const person = opts.people.find((item) => item.id === rule.personId);
    return {
      personId: rule.personId,
      personName: person?.displayName ?? "This person",
      rule,
    };
  });

  const result = checkIngredientsAgainstRules(
    ingredientsForCheck(opts.ingredients, opts.appliedSwapIds ?? []),
    contexts
  );

  const findingsByPerson = new Map<string, RuleCheckFinding[]>();
  for (const finding of [
    ...result.findings.block,
    ...result.findings.warn,
    ...result.findings.prefer_avoid,
  ]) {
    const list = findingsByPerson.get(finding.personId) ?? [];
    list.push(finding);
    findingsByPerson.set(finding.personId, list);
  }

  return {
    status: result.status,
    incompleteReasons: result.incompleteReasons ?? [],
    people: opts.people.map((person) => {
      const findings = collapseRuleFindings(findingsByPerson.get(person.id) ?? []);
      const mark = worstMark(findings);
      const reasons =
        findings.length > 0
          ? [...new Set(findings.map((finding) => reasonForFinding(finding)))]
          : result.status === "incomplete"
            ? (result.incompleteReasons ?? ["This check could not finish."])
            : [`Nothing in this recipe matches ${person.displayName}'s rules.`];
      return {
        personId: person.id,
        personName: person.displayName,
        mark: result.status === "incomplete" && findings.length === 0 ? "warn" : mark,
        title:
          result.status === "incomplete" && findings.length === 0
            ? `Could not finish checking ${person.displayName}`
            : titleFor(person.displayName, mark),
        reasons,
      };
    }),
  };
}
