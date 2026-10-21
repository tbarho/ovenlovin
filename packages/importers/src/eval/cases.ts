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

type AnswerKeysFile = { cases: Record<string, ExpectedRecipe> };

const ANSWER_KEYS = JSON.parse(
  readFileSync(join(here, "fixtures/answer-keys.json"), "utf8")
) as AnswerKeysFile;

function key(job: EvalJob, id: string): ExpectedRecipe {
  const item = ANSWER_KEYS.cases[`${job}/${id}`];
  if (!item) throw new Error(`missing answer key: ${job}/${id}`);
  return item;
}

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
    expected: key("paste", "chocolate-chip-cookies"),
  },
  {
    id: "banana-bread",
    job: "paste",
    text: pasteFile("banana-bread.txt"),
    expected: key("paste", "banana-bread"),
  },
  {
    id: "chicken-noodle-soup",
    job: "paste",
    text: pasteFile("chicken-noodle-soup.txt"),
    expected: key("paste", "chicken-noodle-soup"),
  },
  {
    id: "skillet-pancakes",
    job: "paste",
    text: pasteFile("skillet-pancakes.txt"),
    expected: key("paste", "skillet-pancakes"),
  },
  {
    id: "weeknight-chili",
    job: "paste",
    text: pasteFile("weeknight-chili.txt"),
    expected: key("paste", "weeknight-chili"),
  },
  {
    id: "oatmeal-cookies",
    job: "paste",
    text: pasteFile("oatmeal-cookies.txt"),
    expected: key("paste", "oatmeal-cookies"),
  },
  {
    id: "chicken-pot-pie",
    job: "paste",
    text: pasteFile("chicken-pot-pie.txt"),
    expected: key("paste", "chicken-pot-pie"),
  },
  {
    id: "lentil-soup",
    job: "paste",
    text: pasteFile("lentil-soup.txt"),
    expected: key("paste", "lentil-soup"),
  },
];

export const URL_CASES: EvalCase[] = [
  {
    id: "cookie-and-kate-lentil-soup",
    job: "url",
    html: urlFile("cookie-and-kate-lentil-soup.html"),
    expected: key("url", "cookie-and-kate-lentil-soup"),
  },
  {
    id: "taste-of-home-chicken-potpie",
    job: "url",
    html: urlFile("taste-of-home-chicken-potpie.html"),
    expected: key("url", "taste-of-home-chicken-potpie"),
  },
  {
    id: "wikibooks-ginger-snaps",
    job: "url",
    html: urlFile("wikibooks-ginger-snaps.html"),
    expected: key("url", "wikibooks-ginger-snaps"),
  },
  {
    id: "wikibooks-red-lentil-soup",
    job: "url",
    html: urlFile("wikibooks-red-lentil-soup.html"),
    expected: key("url", "wikibooks-red-lentil-soup"),
  },
  {
    id: "wikibooks-marinara",
    job: "url",
    html: urlFile("wikibooks-marinara.html"),
    expected: key("url", "wikibooks-marinara"),
  },
  {
    id: "wikibooks-banana-bread",
    job: "url",
    html: urlFile("wikibooks-banana-bread.html"),
    expected: key("url", "wikibooks-banana-bread"),
  },
  {
    id: "wikibooks-chocolate-chip-cookies",
    job: "url",
    html: urlFile("wikibooks-chocolate-chip-cookies.html"),
    expected: key("url", "wikibooks-chocolate-chip-cookies"),
  },
  {
    id: "wikibooks-chicken-pot-pie",
    job: "url",
    html: urlFile("wikibooks-chicken-pot-pie.html"),
    expected: key("url", "wikibooks-chicken-pot-pie"),
  },
];

const photoDir = join(here, "fixtures/photo");

export const PHOTO_CASES: EvalCase[] = [
  {
    id: "printed-tomato-pasta",
    job: "photo",
    imagePath: join(photoDir, "printed-tomato-pasta.jpg"),
    expected: key("photo", "printed-tomato-pasta"),
  },
  {
    id: "handwritten-ginger-snaps",
    job: "photo",
    imagePath: join(photoDir, "handwritten-ginger-snaps.jpg"),
    handwritten: true,
    expected: key("photo", "handwritten-ginger-snaps"),
  },
  {
    id: "banana-bread",
    job: "photo",
    imagePath: join(photoDir, "banana-bread.jpg"),
    expected: key("photo", "banana-bread"),
  },
  {
    id: "chicken-noodle-soup",
    job: "photo",
    imagePath: join(photoDir, "chicken-noodle-soup.jpg"),
    expected: key("photo", "chicken-noodle-soup"),
  },
  {
    id: "skillet-pancakes",
    job: "photo",
    imagePath: join(photoDir, "skillet-pancakes.jpg"),
    expected: key("photo", "skillet-pancakes"),
  },
  {
    id: "weeknight-chili",
    job: "photo",
    imagePath: join(photoDir, "weeknight-chili.jpg"),
    expected: key("photo", "weeknight-chili"),
  },
  {
    id: "oatmeal-cookies",
    job: "photo",
    imagePath: join(photoDir, "oatmeal-cookies.jpg"),
    expected: key("photo", "oatmeal-cookies"),
  },
  {
    id: "chicken-pot-pie",
    job: "photo",
    imagePath: join(photoDir, "chicken-pot-pie.jpg"),
    expected: key("photo", "chicken-pot-pie"),
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
