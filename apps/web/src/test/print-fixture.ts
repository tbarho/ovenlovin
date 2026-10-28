/** The big synthetic cookbook the print proof renders. Deterministic, no network images. */
export const PRINT_FIXTURE_ID = "e2e-print-300";

const COURSES = ["Breakfast", "Soups and stews", "Mains", "Sides", "Breads", "Desserts"];
const WORDS =
  "stir the pot slowly and keep the heat low so nothing catches on the bottom of the pan until it smells toasty".split(
    " "
  );

const sentence = (seed: number, length: number) =>
  Array.from({ length }, (_, i) => WORDS[(seed + i * 7) % WORDS.length]).join(" ");

const title = (i: number) =>
  i % 9 === 0
    ? `Grandmother's slow Sunday braised short ribs with roasted root vegetables number ${i}`
    : `Recipe ${i + 1} ${sentence(i, 1 + (i % 4))}`;

function recipe(i: number) {
  const ingredientCount = 4 + (i % 19);
  const stepCount = 2 + (i % 14);
  return {
    id: `fixture-${i}`,
    title: title(i),
    description: i % 3 === 0 ? sentence(i, 20 + (i % 60)) : null,
    familyStory: i % 11 === 0 ? sentence(i + 3, 90) : null,
    course: COURSES[i % COURSES.length],
    servings: 2 + (i % 6),
    prepTimeMinutes: 10 + (i % 5) * 5,
    cookTimeMinutes: i % 2 ? 45 + i : null,
    images: [],
    ingredients: Array.from({ length: ingredientCount }, (_, j) => ({
      name: `ingredient ${(i + j) % 120}`,
      rawText:
        j % 5 === 0
          ? `2 cups ingredient ${(i + j) % 120}, ${sentence(j, 8)}`
          : `1 tbsp ingredient ${(i + j) % 120}`,
      group: i % 4 === 0 ? (j < ingredientCount / 2 ? "For the dough" : "For the filling") : null,
    })),
    steps: Array.from({ length: stepCount }, (_, j) => ({
      text: sentence(i + j, 12 + ((i + j) % 50)),
    })),
  };
}

export function printFixtureCookbook(count = 300) {
  const recipes = Array.from({ length: count }, (_, i) => recipe(i));
  return {
    name: "The Big Fixture Book",
    recipes: COURSES.flatMap((course) => recipes.filter((r) => r.course === course)),
  };
}
