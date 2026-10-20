/* eslint-disable no-undef */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExpectedRecipe } from "./score";

const here = dirname(fileURLToPath(import.meta.url));
const tests = join(here, "../__tests__/fixtures");

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

function testUrl(name: string): string {
  return readFileSync(join(tests, "url", name), "utf8");
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
        "butter",
        "brown sugar",
        "egg",
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
      ],
      stepCount: 4,
      stepMustInclude: ["onion", "lentils", "lemon"],
    },
  },
];

export const URL_CASES: EvalCase[] = [
  {
    id: "smitten-kitchen-slow-roasted-tomatoes",
    job: "url",
    html: urlFile("smitten-kitchen-slow-roasted-tomatoes.html"),
    expected: {
      title: "slow-roasted tomatoes",
      titleAliases: ["slow roasted tomatoes"],
      servings: null,
      ingredients: ["tomatoes", "garlic", "olive oil", "salt", "pepper"],
      stepCount: 3,
      stepMustInclude: ["225", "halve", "3 hours"],
    },
  },
  {
    id: "wikibooks-pancakes",
    job: "url",
    html: testUrl("wikibooks-pancakes.html"),
    expected: {
      title: "Pancakes",
      titleAliases: ["Cookbook:Pancakes"],
      servings: null,
      ingredients: ["flour", "sugar", "baking powder", "milk", "egg", "butter"],
      stepCount: 3,
      stepMustInclude: ["whisk", "milk", "skillet"],
    },
  },
  {
    id: "plain-blog-tomato-pasta",
    job: "url",
    html: testUrl("plain-blog-tomato-pasta.html"),
    expected: {
      title: "Weeknight Tomato Pasta",
      servings: null,
      ingredients: ["pasta", "olive oil", "garlic", "crushed tomatoes", "basil"],
      stepCount: 3,
      stepMustInclude: ["pasta", "garlic", "basil"],
    },
  },
  {
    id: "cookie-and-kate-oatmeal",
    job: "url",
    html: urlFile("cookie-and-kate-oatmeal.html"),
    expected: {
      title: "Chewy Oatmeal Cookies",
      servings: 24,
      ingredients: ["oats", "flour", "baking soda", "cinnamon", "butter", "brown sugar", "raisins"],
      stepCount: 5,
      stepMustInclude: ["350", "oats", "raisins"],
    },
  },
  {
    id: "budget-bytes-chili",
    job: "url",
    html: urlFile("budget-bytes-chili.html"),
    expected: {
      title: "Weeknight Chili",
      servings: 6,
      ingredients: ["ground beef", "onion", "garlic", "chili powder", "tomatoes", "kidney beans"],
      stepCount: 4,
      stepMustInclude: ["brown", "chili powder", "simmer"],
    },
  },
  {
    id: "half-baked-harvest-bars",
    job: "url",
    html: urlFile("half-baked-harvest-bars.html"),
    expected: {
      title: "One-Bowl Cocoa Snack Bars",
      servings: 16,
      ingredients: ["butter", "brown sugar", "eggs", "cocoa", "flour", "chocolate chips"],
      stepCount: 4,
      stepMustInclude: ["350", "cocoa", "bake", "16"],
    },
  },
  {
    id: "taste-of-home-pot-pie",
    job: "url",
    html: urlFile("taste-of-home-pot-pie.html"),
    expected: {
      title: "Chicken Pot Pie",
      servings: [8, 16],
      ingredients: [
        "pie crusts",
        "chicken",
        "mixed vegetables",
        "butter",
        "flour",
        "chicken broth",
        "milk",
      ],
      stepCount: 5,
      stepMustInclude: ["425", "flour", "chicken", "crust"],
    },
  },
  {
    id: "plain-lentil-soup",
    job: "url",
    html: urlFile("plain-lentil-soup.html"),
    expected: {
      title: "Red Lentil Soup",
      servings: 4,
      ingredients: ["olive oil", "onion", "garlic", "cumin", "red lentils", "lemon"],
      stepCount: 4,
      stepMustInclude: ["onion", "lentils", "lemon"],
    },
  },
];

const photoDir = join(here, "fixtures/photo");

export const PHOTO_CASES: EvalCase[] = [
  {
    id: "printed-tomato-pasta",
    job: "photo",
    imagePath: join(tests, "photo/printed-tomato-pasta.png"),
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
    imagePath: join(tests, "photo/handwritten-ginger-snaps.png"),
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
        "ginger",
      ],
      stepCount: 7,
      stepMustInclude: ["molasses", "chill", "sugar", "375"],
    },
  },
  {
    id: "banana-bread",
    job: "photo",
    imagePath: join(photoDir, "banana-bread.png"),
    expected: PASTE_CASES.find((item) => item.id === "banana-bread")!.expected,
  },
  {
    id: "chicken-noodle-soup",
    job: "photo",
    imagePath: join(photoDir, "chicken-noodle-soup.png"),
    expected: PASTE_CASES.find((item) => item.id === "chicken-noodle-soup")!.expected,
  },
  {
    id: "skillet-pancakes",
    job: "photo",
    imagePath: join(photoDir, "skillet-pancakes.png"),
    expected: PASTE_CASES.find((item) => item.id === "skillet-pancakes")!.expected,
  },
  {
    id: "weeknight-chili",
    job: "photo",
    imagePath: join(photoDir, "weeknight-chili.png"),
    expected: PASTE_CASES.find((item) => item.id === "weeknight-chili")!.expected,
  },
  {
    id: "oatmeal-cookies",
    job: "photo",
    imagePath: join(photoDir, "oatmeal-cookies.png"),
    expected: PASTE_CASES.find((item) => item.id === "oatmeal-cookies")!.expected,
  },
  {
    id: "chicken-pot-pie",
    job: "photo",
    imagePath: join(photoDir, "chicken-pot-pie.png"),
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
