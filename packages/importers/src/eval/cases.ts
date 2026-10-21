/* eslint-disable no-undef */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { ExpectedRecipe } from "./score";

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

export const PASTE_CASES: EvalCase[] = [
  {
    id: "chocolate-chip-cookies",
    job: "paste",
    text: readFileSync(join(tests, "paste/chocolate-chip-cookies.txt"), "utf8"),
    expected: {
      title: "Classic Chocolate Chip Cookies",
      servings: 24,
      ingredients: [
        "all-purpose flour",
        "baking soda",
        "salt",
        "butter",
        "granulated sugar",
        "brown sugar",
        "eggs",
        "vanilla",
        "chocolate chips",
      ],
      stepCount: 6,
      stepMustInclude: ["375", "flour", "chocolate chips", "bake"],
    },
  },
  {
    id: "banana-bread",
    job: "paste",
    text: pasteFile("banana-bread.txt"),
    expected: {
      title: "Banana Bread",
      servings: 10,
      ingredients: ["bananas", "butter", "sugar", "egg", "vanilla", "baking soda", "salt", "flour"],
      stepCount: 5,
      stepMustInclude: ["350", "bananas", "flour", "toothpick"],
    },
  },
  {
    id: "chicken-noodle-soup",
    job: "paste",
    text: pasteFile("chicken-noodle-soup.txt"),
    expected: {
      title: "Chicken Noodle Soup",
      servings: 6,
      ingredients: [
        "olive oil",
        "onion",
        "carrots",
        "celery",
        "chicken broth",
        "chicken",
        "egg noodles",
        "salt",
        "black pepper",
        "parsley",
      ],
      stepCount: 4,
      stepMustInclude: ["onion", "broth", "noodles", "parsley"],
    },
  },
  {
    id: "skillet-pancakes",
    job: "paste",
    text: pasteFile("skillet-pancakes.txt"),
    expected: {
      title: "Skillet Pancakes",
      servings: 4,
      ingredients: ["flour", "sugar", "baking powder", "milk", "egg", "butter"],
      stepCount: 3,
      stepMustInclude: ["whisk", "milk", "skillet"],
    },
  },
  {
    id: "weeknight-chili",
    job: "paste",
    text: pasteFile("weeknight-chili.txt"),
    expected: {
      title: "Weeknight Chili",
      servings: 6,
      ingredients: [
        "ground beef",
        "onion",
        "garlic",
        "chili powder",
        "cumin",
        "tomatoes",
        "kidney beans",
        "beef broth",
        "salt",
      ],
      stepCount: 4,
      stepMustInclude: ["brown", "chili powder", "simmer"],
    },
  },
  {
    id: "oatmeal-cookies",
    job: "paste",
    text: pasteFile("oatmeal-cookies.txt"),
    expected: {
      title: "Chewy Oatmeal Cookies",
      servings: 24,
      ingredients: [
        "oats",
        "flour",
        "baking soda",
        "cinnamon",
        "salt",
        "butter",
        "brown sugar",
        "egg",
        "vanilla",
        "raisins",
      ],
      stepCount: 5,
      stepMustInclude: ["350", "oats", "raisins", "bake"],
    },
  },
  {
    id: "chicken-pot-pie",
    job: "paste",
    text: pasteFile("chicken-pot-pie.txt"),
    expected: {
      title: "Chicken Pot Pie",
      servings: [8, 16],
      ingredients: [
        "pie crusts",
        "chicken",
        "mixed vegetables",
        "butter",
        "flour",
        "salt",
        "black pepper",
        "chicken broth",
        "milk",
      ],
      stepCount: 5,
      stepMustInclude: ["425", "flour", "chicken", "crust"],
    },
  },
  {
    id: "lentil-soup",
    job: "paste",
    text: pasteFile("lentil-soup.txt"),
    expected: {
      title: "Red Lentil Soup",
      servings: 4,
      ingredients: [
        "olive oil",
        "onion",
        "garlic",
        "cumin",
        "red lentils",
        "vegetable broth",
        "lemon",
        "salt",
      ],
      stepCount: 4,
      stepMustInclude: ["onion", "lentils", "lemon"],
    },
  },
];

export const URL_CASES: EvalCase[] = [
  {
    id: "cookie-and-kate-lentil-soup",
    job: "url",
    html: urlFile("cookie-and-kate-lentil-soup.html"),
    expected: {
      title: "Best Lentil Soup",
      titleAliases: ["Best Lentil Soup Recipe"],
      servings: [4, 6],
      ingredients: [
        "olive oil",
        "onion",
        "carrots",
        "garlic",
        "cumin",
        "curry powder",
        "thyme",
        "tomatoes",
        "lentils",
        "vegetable broth",
        "salt",
        "lemon",
      ],
      stepCount: 6,
      stepMustInclude: ["onion", "garlic", "tomatoes", "simmer", "lemon"],
    },
  },
  {
    id: "taste-of-home-chicken-potpie",
    job: "url",
    html: urlFile("taste-of-home-chicken-potpie.html"),
    expected: {
      title: "Chicken Potpie",
      titleAliases: ["Best Chicken Potpie", "Chicken Pot Pie"],
      servings: [8, 16],
      ingredients: [
        "potatoes",
        "carrots",
        "butter",
        "onion",
        "flour",
        "thyme",
        "chicken broth",
        "milk",
        "chicken",
        "peas",
        "corn",
        "pie crust",
      ],
      stepCount: 5,
      stepMustInclude: ["425", "potatoes", "flour", "chicken", "crust"],
    },
  },
  {
    id: "wikibooks-ginger-snaps",
    job: "url",
    html: urlFile("wikibooks-ginger-snaps.html"),
    expected: {
      title: "Ginger Snaps",
      servings: null,
      ingredients: [
        "butter",
        "molasses",
        "brown sugar",
        "cinnamon",
        "cloves",
        "nutmeg",
        "ginger",
        "flour",
      ],
      stepCount: 5,
      stepMustInclude: ["molasses", "chill", "350", "bake"],
    },
  },
  {
    id: "wikibooks-red-lentil-soup",
    job: "url",
    html: urlFile("wikibooks-red-lentil-soup.html"),
    expected: {
      title: "Red Lentil Soup",
      servings: 4,
      ingredients: ["olive oil", "onion", "carrots", "garlic", "red lentils", "bay leaf"],
      stepCount: 5,
      stepMustInclude: ["onion", "lentils", "simmer"],
    },
  },
  {
    id: "wikibooks-marinara",
    job: "url",
    html: urlFile("wikibooks-marinara.html"),
    expected: {
      title: "Marinara Sauce",
      servings: 6,
      ingredients: [
        "olive oil",
        "onion",
        "garlic",
        "thyme",
        "basil",
        "red bell pepper",
        "tomatoes",
        "sugar",
      ],
      stepCount: 4,
      stepMustInclude: ["onion", "tomatoes", "simmer"],
    },
  },
  {
    id: "wikibooks-banana-bread",
    job: "url",
    html: urlFile("wikibooks-banana-bread.html"),
    expected: {
      title: "Banana Bread",
      servings: null,
      ingredients: [
        "sugar",
        "butter",
        "bananas",
        "eggs",
        "flour",
        "baking soda",
        "salt",
        "vanilla",
      ],
      stepCount: 4,
      stepMustInclude: ["350", "bananas", "toothpick"],
    },
  },
  {
    id: "wikibooks-chocolate-chip-cookies",
    job: "url",
    html: urlFile("wikibooks-chocolate-chip-cookies.html"),
    expected: {
      title: "Chocolate Chip Cookies",
      titleAliases: ["Chocolate Chip Cookies I"],
      servings: [10, 56],
      ingredients: [
        "butter",
        "sugar",
        "brown sugar",
        "vanilla",
        "eggs",
        "flour",
        "baking soda",
        "salt",
        "chocolate",
      ],
      stepCount: 6,
      stepMustInclude: ["375", "cream", "chocolate", "bake"],
    },
  },
  {
    id: "wikibooks-chicken-pot-pie",
    job: "url",
    html: urlFile("wikibooks-chicken-pot-pie.html"),
    expected: {
      title: "Chicken Pot Pie",
      titleAliases: ["Chicken Pot Pie II"],
      servings: null,
      ingredients: [
        "pie crusts",
        "butter",
        "onion",
        "flour",
        "chicken broth",
        "milk",
        "chicken",
        "corn",
        "peas",
      ],
      stepCount: 5,
      stepMustInclude: ["425", "onion", "chicken", "crust"],
    },
  },
];

const photoDir = join(here, "fixtures/photo");

export const PHOTO_CASES: EvalCase[] = [
  {
    id: "printed-tomato-pasta",
    job: "photo",
    imagePath: join(photoDir, "printed-tomato-pasta.jpg"),
    expected: {
      title: "Weeknight Tomato Pasta",
      servings: 4,
      ingredients: ["pasta", "crushed tomatoes", "olive oil", "parmesan"],
      stepCount: 3,
      stepMustInclude: ["pasta", "tomatoes", "parmesan"],
    },
  },
  {
    id: "handwritten-ginger-snaps",
    job: "photo",
    imagePath: join(photoDir, "handwritten-ginger-snaps.jpg"),
    handwritten: true,
    expected: {
      title: "Ginger Snaps",
      titleAliases: ["Grandma's Ginger Snaps"],
      servings: 48,
      ingredients: [
        "shortening",
        "sugar",
        "egg",
        "molasses",
        "flour",
        "baking soda",
        "cinnamon",
        "cloves",
        "ginger",
      ],
      stepCount: 7,
      stepMustInclude: ["molasses", "chill", "sugar", "375"],
    },
  },
  {
    id: "banana-bread",
    job: "photo",
    imagePath: join(photoDir, "banana-bread.jpg"),
    expected: PASTE_CASES.find((item) => item.id === "banana-bread")!.expected,
  },
  {
    id: "chicken-noodle-soup",
    job: "photo",
    imagePath: join(photoDir, "chicken-noodle-soup.jpg"),
    expected: PASTE_CASES.find((item) => item.id === "chicken-noodle-soup")!.expected,
  },
  {
    id: "skillet-pancakes",
    job: "photo",
    imagePath: join(photoDir, "skillet-pancakes.jpg"),
    expected: PASTE_CASES.find((item) => item.id === "skillet-pancakes")!.expected,
  },
  {
    id: "weeknight-chili",
    job: "photo",
    imagePath: join(photoDir, "weeknight-chili.jpg"),
    expected: PASTE_CASES.find((item) => item.id === "weeknight-chili")!.expected,
  },
  {
    id: "oatmeal-cookies",
    job: "photo",
    imagePath: join(photoDir, "oatmeal-cookies.jpg"),
    expected: PASTE_CASES.find((item) => item.id === "oatmeal-cookies")!.expected,
  },
  {
    id: "chicken-pot-pie",
    job: "photo",
    imagePath: join(photoDir, "chicken-pot-pie.jpg"),
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
