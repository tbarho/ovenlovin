import { pageTextFromHtml } from "../utils/page-text";
import { normalizeText, type ObservedRecipe } from "./score";

const UNIT =
  /\b(?:cups?|c\.|tsp|tbsp|teaspoons?|tablespoons?|oz|ounces?|lb|pounds?|g|kg|ml|ea\.|cloves?|jars?|cans?|sticks?)\b/i;

const STEP_HEADING = /^(procedure|instructions|directions|preparation|method):?$/i;
const STEP_STOP =
  /^(notes|references|see also|categories|nutrition|recipe variations|how to |tips for|watch how|medium difficulty)/i;
const STEP_VERB =
  /^(?:mix|sift|chill|roll|dip|place|bake|combine|add|heat|preheat|stir|cook|pour|serve|season|transfer|warm|brown|whisk|beat|drop|let|finished)\b/i;

function looksLikeIngredient(line: string): boolean {
  if (line.length < 3 || line.length > 160) return false;
  if (/^total\b|^\[note|nutrition facts|^step \d/i.test(line)) return false;
  if (STEP_VERB.test(line)) return false;
  if (/^(?:pinch of|freshly ground|salt to taste|a little )\b/i.test(line)) return true;
  if (/^(?:\d|1\/|¼|½|⅓|⅔|¾)/.test(line) && (UNIT.test(line) || /\beggs?\b/i.test(line))) {
    return true;
  }
  return UNIT.test(line) && /^[a-z]/i.test(line);
}

function stripEdit(line: string): string {
  return line.replace(/\s*\[edit[^\]]*\]/g, "").trim();
}

function numberedRuns(lines: string[]): string[][] {
  const runs: string[][] = [];
  let run: string[] = [];
  let expect = 1;
  const flush = () => {
    if (run.length >= 3) runs.push(run);
    run = [];
    expect = 1;
  };
  for (const line of lines) {
    const match = line.match(/^(\d+)[.)]\s+(.*)$/) ?? line.match(/^(\d+)\s+([A-Z].*)$/);
    if (!match?.[1] || match[2] == null) {
      flush();
      continue;
    }
    const n = Number(match[1]);
    if (n === expect) {
      run.push(match[2]);
      expect += 1;
    } else {
      flush();
      if (n === 1) {
        run = [match[2]];
        expect = 2;
      }
    }
  }
  flush();
  return runs;
}

function sectionLines(lines: string[], start: RegExp, stop: RegExp): string[] {
  const begin = lines.findIndex((line) => start.test(line) && line.length < 60);
  if (begin < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(begin + 1)) {
    if (stop.test(line) && line.length < 80) break;
    if (STEP_HEADING.test(line)) break;
    out.push(line);
  }
  return out;
}

export function parseRecipeSource(text: string): {
  title: string;
  ingredients: string[];
  steps: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((line) => stripEdit(line).replace(/^\s*[-*]\s+/, ""))
    .filter((line) => line.length > 1);

  const title =
    lines.find((line) => !/^(serves|makes|prep|cook|yield|servings)\b/i.test(line)) ?? "";

  const seen = new Set<string>();
  const ingredients: string[] = [];
  const start = lines.findIndex(
    (line) => /ingredient/i.test(line) && line.length < 60 && !looksLikeIngredient(line)
  );
  const scan = start >= 0 ? lines.slice(start + 1) : lines;
  const take = (line: string) => {
    if (!looksLikeIngredient(line)) return;
    const key = normalizeText(line);
    if (!key || seen.has(key)) return;
    seen.add(key);
    ingredients.push(line);
  };
  for (const line of scan) {
    if (STEP_HEADING.test(line)) break;
    take(line);
  }
  if (ingredients.length < 3) {
    for (const line of lines) take(line);
  }

  const numbered = numberedRuns(lines).at(-1);
  const rawSection = sectionLines(lines, STEP_HEADING, STEP_STOP);
  const article = rawSection.some((line) => /^step \d/i.test(line));
  const fromSection = rawSection.filter((line) => !/^step \d/i.test(line) && line.length > 8);
  let steps =
    article && numbered ? numbered : fromSection.length >= 3 ? fromSection : (numbered ?? []);

  if (steps.length === 0 && ingredients.length > 0) {
    const last = ingredients[ingredients.length - 1];
    const idx = last ? lines.lastIndexOf(last) : -1;
    steps = lines
      .slice(idx + 1)
      .filter(
        (line) =>
          !looksLikeIngredient(line) &&
          !/^(serves|makes|prep|cook|yield|ingredients|instructions)\b/i.test(line)
      );
  }

  return { title, ingredients, steps };
}

export function sourceServings(text: string): number | undefined {
  const match =
    text.match(/(\d+)\s+servings\b/i) ??
    text.match(/serves\s+(\d+)\b/i) ??
    text.match(/servings\s*(\d+)\b/i) ??
    text.match(/yield:?\s*(\d+)\b/i) ??
    text.match(/makes\s+(\d+)\b/i);
  return match?.[1] ? Number(match[1]) : undefined;
}

export function sourceObserved(evalCase: {
  html?: string;
  text?: string;
  expected: { servings?: number | number[] | null };
}): ObservedRecipe {
  const text = evalCase.html ? pageTextFromHtml(evalCase.html) : (evalCase.text ?? "");
  const parsed = parseRecipeSource(text);
  return {
    title: parsed.title,
    servings: evalCase.expected.servings == null ? undefined : sourceServings(text),
    ingredients: parsed.ingredients,
    steps: parsed.steps,
  };
}
