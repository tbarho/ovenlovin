/** Synthetic cookbook pages (lines per page) for contents-map fixtures and the e2e seed. */
const recipe = (title: string, printed: number, ingredients: string[]) => [
  title,
  "Serves 4",
  ...ingredients,
  "Mix, cook, and serve warm.",
  String(printed),
];

/** Contents on page 1, recipes printed from page 2 with no front matter shift. */
export const TEXT_BOOK = [
  [
    "Contents",
    "Breakfast",
    "Buttermilk Pancakes ........ 2",
    "Oat Porridge ........ 3",
    "Suppers",
    "Tomato Soup ........ 4",
    "Roast Chicken ........ 5",
  ],
  recipe("Buttermilk Pancakes", 2, ["2 cups flour", "1 cup buttermilk", "2 eggs"]),
  recipe("Oat Porridge", 3, ["1 cup oats", "2 cups milk", "1 pinch of salt"]),
  recipe("Tomato Soup", 4, ["6 tomatoes", "1 onion", "2 cups stock"]),
  recipe("Roast Chicken", 5, ["1 whole chicken", "2 lemons", "4 cloves garlic"]),
];

/** Title page, dedication, and contents before printed page 1: offset 3. */
export const OFFSET_BOOK = [
  ["A Synthetic Kitchen", "Author A"],
  ["For Household 1"],
  [
    "Contents",
    "Baking",
    "Lemon Bars ........ 1",
    "Shortbread ........ 2",
    "Ginger Snaps ........ 3",
  ],
  recipe("Lemon Bars", 1, ["1 cup flour", "2 lemons", "3 eggs"]),
  recipe("Shortbread", 2, ["2 cups flour", "1 cup butter", "1/2 cup sugar"]),
  recipe("Ginger Snaps", 3, ["2 cups flour", "1 tbsp ginger", "1/2 cup molasses"]),
];

/** No contents: two text recipe pages around two scanned pages with no text layer. */
export const SCANNED_BOOK = [
  recipe("Fish Stew", 1, ["1 lb white fish", "2 potatoes", "1 leek"]),
  [],
  [],
  recipe("Rice Pudding", 4, ["1/2 cup rice", "4 cups milk", "1/3 cup sugar"]),
];

/**
 * Per-recipe extraction: Pancakes cross a page break with a photo and a tiny
 * ornament, Fish Stew is a page scan, a "Suppers" divider sits before Soup.
 * PDF pages are printed pages plus one (contents first).
 */
export const PHOTO_BOOK = {
  info: { title: "A Synthetic Kitchen", author: "Author A" },
  pages: [
    [
      "Contents",
      "Breakfast",
      "Buttermilk Pancakes ........ 1",
      "Fish Stew ........ 3",
      "Suppers",
      "Tomato Soup ........ 5",
    ],
    {
      lines: [
        "Breakfast 1",
        "Buttermilk Pancakes",
        "Our Sunday stack, doubled on birthdays.",
        "Serves 4",
        "2 cups flour",
        "1 cup butter-",
        "1",
      ],
      images: [
        { width: 300, height: 220, y: 400 },
        { width: 24, height: 24, x: 500, y: 40 },
      ],
    },
    { lines: ["Breakfast 2", "milk", "2 eggs", "Whisk and cook on a hot griddle.", "2"] },
    { lines: [], images: [{ width: 240, height: 320, x: 0, y: 0 }] },
    ["Suppers", "4"],
    {
      lines: [
        "Tomato Soup",
        "Serves 4",
        "6 tomatoes",
        "1 onion",
        "2 cups stock",
        "Simmer and blend.",
        "5",
      ],
      images: [{ width: 24, height: 24, x: 500, y: 40 }],
    },
  ],
};
