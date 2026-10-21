/* eslint-disable no-undef */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pageTextFromHtml } from "../utils/page-text";
import type { ExpectedRecipe } from "./score";
import { parseRecipeSource } from "./source";

const importersRoot = dirname(
  createRequire(import.meta.url).resolve("@ovenlovin/importers/package.json")
);
const here = join(importersRoot, "src/eval");
const tests = join(importersRoot, "src/__tests__/fixtures");

export type EvalJob = "paste" | "photo" | "url";

export type EvalCase = {
  id: string;
  job: EvalJob;
  expected: ExpectedRecipe;
  text?: string;
  html?: string;
  imagePath?: string;
  handwritten?: boolean;
};

function pasteFile(name: string): string {
  return readFileSync(join(here, "fixtures/paste", name), "utf8");
}

function urlFile(name: string): string {
  return readFileSync(join(here, "fixtures/url", name), "utf8");
}

function fromSource(
  text: string,
  meta: Omit<ExpectedRecipe, "ingredients" | "stepCount">
): ExpectedRecipe {
  const parsed = parseRecipeSource(text);
  return { ...meta, ingredients: parsed.ingredients, stepCount: parsed.steps.length };
}

export const PASTE_CASES: EvalCase[] = [
  {
    id: "chocolate-chip-cookies",
    job: "paste",
    text: readFileSync(join(tests, "paste/chocolate-chip-cookies.txt"), "utf8"),
    expected: fromSource(readFileSync(join(tests, "paste/chocolate-chip-cookies.txt"), "utf8"), {
      title: "Classic Chocolate Chip Cookies",
      servings: 24,
      stepMustInclude: ["375", "flour", "chocolate chips", "bake"],
    }),
  },
  {
    id: "banana-bread",
    job: "paste",
    text: pasteFile("banana-bread.txt"),
    expected: fromSource(pasteFile("banana-bread.txt"), {
      title: "Banana Bread",
      servings: 10,
      stepMustInclude: ["350", "bananas", "flour", "toothpick"],
    }),
  },
  {
    id: "chicken-noodle-soup",
    job: "paste",
    text: pasteFile("chicken-noodle-soup.txt"),
    expected: fromSource(pasteFile("chicken-noodle-soup.txt"), {
      title: "Chicken Noodle Soup",
      servings: 6,
      stepMustInclude: ["onion", "broth", "noodles", "parsley"],
    }),
  },
  {
    id: "skillet-pancakes",
    job: "paste",
    text: pasteFile("skillet-pancakes.txt"),
    expected: fromSource(pasteFile("skillet-pancakes.txt"), {
      title: "Skillet Pancakes",
      servings: 4,
      stepMustInclude: ["whisk", "milk", "skillet"],
    }),
  },
  {
    id: "weeknight-chili",
    job: "paste",
    text: pasteFile("weeknight-chili.txt"),
    expected: fromSource(pasteFile("weeknight-chili.txt"), {
      title: "Weeknight Chili",
      servings: 6,
      stepMustInclude: ["brown", "chili powder", "simmer"],
    }),
  },
  {
    id: "oatmeal-cookies",
    job: "paste",
    text: pasteFile("oatmeal-cookies.txt"),
    expected: fromSource(pasteFile("oatmeal-cookies.txt"), {
      title: "Chewy Oatmeal Cookies",
      servings: 24,
      stepMustInclude: ["350", "oats", "raisins", "bake"],
    }),
  },
  {
    id: "chicken-pot-pie",
    job: "paste",
    text: pasteFile("chicken-pot-pie.txt"),
    expected: fromSource(pasteFile("chicken-pot-pie.txt"), {
      title: "Chicken Pot Pie",
      servings: [8, 16],
      stepMustInclude: ["425", "flour", "chicken", "crust"],
    }),
  },
  {
    id: "lentil-soup",
    job: "paste",
    text: pasteFile("lentil-soup.txt"),
    expected: fromSource(pasteFile("lentil-soup.txt"), {
      title: "Red Lentil Soup",
      servings: 4,
      stepMustInclude: ["onion", "lentils", "lemon"],
    }),
  },
];

export const URL_CASES: EvalCase[] = [
  {
    id: "cookie-and-kate-lentil-soup",
    job: "url",
    html: urlFile("cookie-and-kate-lentil-soup.html"),
    expected: fromSource(pageTextFromHtml(urlFile("cookie-and-kate-lentil-soup.html")), {
      title: "Best Lentil Soup",
      titleAliases: ["Best Lentil Soup Recipe"],
      servings: [4, 6],
      stepMustInclude: ["onion", "garlic", "tomatoes", "simmer", "lemon"],
    }),
  },
  {
    id: "taste-of-home-chicken-potpie",
    job: "url",
    html: urlFile("taste-of-home-chicken-potpie.html"),
    expected: fromSource(pageTextFromHtml(urlFile("taste-of-home-chicken-potpie.html")), {
      title: "Chicken Potpie",
      titleAliases: ["Best Chicken Potpie", "Chicken Pot Pie"],
      servings: null,
      stepMustInclude: ["425", "potatoes", "flour", "chicken", "crust"],
    }),
  },
  {
    id: "wikibooks-ginger-snaps",
    job: "url",
    html: urlFile("wikibooks-ginger-snaps.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-ginger-snaps.html")), {
      title: "Ginger Snaps",
      servings: null,
      stepMustInclude: ["molasses", "chill", "350", "bake"],
    }),
  },
  {
    id: "wikibooks-red-lentil-soup",
    job: "url",
    html: urlFile("wikibooks-red-lentil-soup.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-red-lentil-soup.html")), {
      title: "Red Lentil Soup",
      servings: null,
      stepMustInclude: ["onion", "lentils", "simmer"],
    }),
  },
  {
    id: "wikibooks-marinara",
    job: "url",
    html: urlFile("wikibooks-marinara.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-marinara.html")), {
      title: "Marinara Sauce",
      servings: null,
      stepMustInclude: ["onion", "tomatoes", "simmer"],
    }),
  },
  {
    id: "wikibooks-banana-bread",
    job: "url",
    html: urlFile("wikibooks-banana-bread.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-banana-bread.html")), {
      title: "Banana Bread",
      servings: null,
      stepMustInclude: ["350", "toothpick"],
    }),
  },
  {
    id: "wikibooks-chocolate-chip-cookies",
    job: "url",
    html: urlFile("wikibooks-chocolate-chip-cookies.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-chocolate-chip-cookies.html")), {
      title: "Chocolate Chip Cookies",
      titleAliases: ["Chocolate Chip Cookies I"],
      servings: null,
      stepMustInclude: ["375", "cream", "chocolate", "bake"],
    }),
  },
  {
    id: "wikibooks-chicken-pot-pie",
    job: "url",
    html: urlFile("wikibooks-chicken-pot-pie.html"),
    expected: fromSource(pageTextFromHtml(urlFile("wikibooks-chicken-pot-pie.html")), {
      title: "Chicken Pot Pie",
      titleAliases: ["Chicken Pot Pie II"],
      servings: null,
      stepMustInclude: ["425", "onion", "chicken", "crust"],
    }),
  },
];

const photoDir = join(here, "fixtures/photo");

const TOMATO_CARD = `Weeknight Tomato Pasta
Weeknight Dinners, p. 42

Serves 4

Ingredients
12 oz pasta
1 jar crushed tomatoes
2 tbsp olive oil
1/2 cup grated parmesan

Instructions
1. Boil pasta in salted water until al dente.
2. Warm tomatoes with olive oil.
3. Toss pasta with sauce and parmesan.

Salt the pasta water well.
`;

const GINGER_CARD = `Grandma's Ginger Snaps
Makes 48

3/4 c. shortening
1 c. sugar
1 egg
1/4 c. molasses
2 c. flour
2 tsp. baking soda
1 tsp. cinnamon
1 tsp. cloves
1 tsp. ginger

Mix shortening, sugar, egg and molasses thoroughly.
Sift together flour, baking soda, and spices; blend in.
Chill dough.
Roll into balls the size of large walnuts.
Dip tops in sugar.
Place sugar side up on greased baking sheet.
Bake 10-12 min. at 375°.
`;

export const PHOTO_CASES: EvalCase[] = [
  {
    id: "printed-tomato-pasta",
    job: "photo",
    imagePath: join(photoDir, "printed-tomato-pasta.jpg"),
    text: TOMATO_CARD,
    expected: fromSource(TOMATO_CARD, {
      title: "Weeknight Tomato Pasta",
      servings: 4,
      stepMustInclude: ["pasta", "tomatoes", "parmesan"],
    }),
  },
  {
    id: "handwritten-ginger-snaps",
    job: "photo",
    imagePath: join(photoDir, "handwritten-ginger-snaps.jpg"),
    handwritten: true,
    text: GINGER_CARD,
    expected: fromSource(GINGER_CARD, {
      title: "Ginger Snaps",
      titleAliases: ["Grandma's Ginger Snaps"],
      servings: 48,
      stepMustInclude: ["molasses", "chill", "sugar", "375"],
    }),
  },
  {
    id: "banana-bread",
    job: "photo",
    imagePath: join(photoDir, "banana-bread.jpg"),
    text: pasteFile("banana-bread.txt"),
    expected: PASTE_CASES.find((item) => item.id === "banana-bread")!.expected,
  },
  {
    id: "chicken-noodle-soup",
    job: "photo",
    imagePath: join(photoDir, "chicken-noodle-soup.jpg"),
    text: pasteFile("chicken-noodle-soup.txt"),
    expected: PASTE_CASES.find((item) => item.id === "chicken-noodle-soup")!.expected,
  },
  {
    id: "skillet-pancakes",
    job: "photo",
    imagePath: join(photoDir, "skillet-pancakes.jpg"),
    text: pasteFile("skillet-pancakes.txt"),
    expected: PASTE_CASES.find((item) => item.id === "skillet-pancakes")!.expected,
  },
  {
    id: "weeknight-chili",
    job: "photo",
    imagePath: join(photoDir, "weeknight-chili.jpg"),
    text: pasteFile("weeknight-chili.txt"),
    expected: PASTE_CASES.find((item) => item.id === "weeknight-chili")!.expected,
  },
  {
    id: "oatmeal-cookies",
    job: "photo",
    imagePath: join(photoDir, "oatmeal-cookies.jpg"),
    text: pasteFile("oatmeal-cookies.txt"),
    expected: PASTE_CASES.find((item) => item.id === "oatmeal-cookies")!.expected,
  },
  {
    id: "chicken-pot-pie",
    job: "photo",
    imagePath: join(photoDir, "chicken-pot-pie.jpg"),
    text: pasteFile("chicken-pot-pie.txt"),
    expected: PASTE_CASES.find((item) => item.id === "chicken-pot-pie")!.expected,
  },
];

export const ALL_CASES: EvalCase[] = [...PASTE_CASES, ...PHOTO_CASES, ...URL_CASES];

export const EVAL_MODELS = [
  "spacexai/grok-4.7",
  "deepseek/deepseek-v4.1-flash",
  "openai/gpt-6-luna",
] as const;

export function resolveEvalModels(env: Record<string, string | undefined> = process.env): string[] {
  const single = env.EVAL_IMPORT_MODEL?.trim();
  if (single) return [single];
  const many = env.EVAL_IMPORT_MODELS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (many && many.length > 0) return many;
  return [...EVAL_MODELS];
}
