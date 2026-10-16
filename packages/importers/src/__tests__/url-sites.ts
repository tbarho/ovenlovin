export type RecordedSiteExtractor = "json-ld" | "html";

export type RecordedUrlSite = {
  id: string;
  host: string;
  url: string;
  fixture: string;
  title: RegExp;
  minIngredients: number;
  minSteps: number;
  extractor: RecordedSiteExtractor;
};

/** Ten popular recipe pages plus a plain blog. Fixtures are recorded snapshots. */
export const RECORDED_URL_SITES: RecordedUrlSite[] = [
  {
    id: "allrecipes",
    host: "allrecipes.com",
    url: "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/",
    fixture: "allrecipes-chocolate-chip-cookies.html",
    title: /chocolate chip cookies/i,
    minIngredients: 8,
    minSteps: 4,
    extractor: "json-ld",
  },
  {
    id: "simplyrecipes",
    host: "simplyrecipes.com",
    url: "https://www.simplyrecipes.com/recipes/chocolate_chip_cookies/",
    fixture: "simplyrecipes-chocolate-chip-cookies.html",
    title: /chocolate chip cookies/i,
    minIngredients: 8,
    minSteps: 4,
    extractor: "json-ld",
  },
  {
    id: "budgetbytes",
    host: "budgetbytes.com",
    url: "https://www.budgetbytes.com/beef-stroganoff/",
    fixture: "budgetbytes-beef-stroganoff.html",
    title: /stroganoff/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "seriouseats",
    host: "seriouseats.com",
    url: "https://www.seriouseats.com/the-food-lab-best-chocolate-chip-cookie-recipe",
    fixture: "seriouseats-chocolate-chip-cookies.html",
    title: /chocolate chip cookies/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "natashaskitchen",
    host: "natashaskitchen.com",
    url: "https://natashaskitchen.com/beef-stroganoff/",
    fixture: "natashaskitchen-beef-stroganoff.html",
    title: /stroganoff/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "foodnetwork",
    host: "foodnetwork.com",
    url: "https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909047",
    fixture: "foodnetwork-the-chewy.html",
    title: /chewy/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "bonappetit",
    host: "bonappetit.com",
    url: "https://www.bonappetit.com/recipe/bas-best-chocolate-chip-cookies",
    fixture: "bonappetit-chocolate-chip-cookies.html",
    title: /chocolate chip cookies/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "nytcooking",
    host: "cooking.nytimes.com",
    url: "https://cooking.nytimes.com/recipes/1015819-chocolate-chip-cookies",
    fixture: "nytcooking-chocolate-chip-cookies.html",
    title: /chocolate chip cookies/i,
    minIngredients: 8,
    minSteps: 3,
    extractor: "json-ld",
  },
  {
    id: "wikibooks",
    host: "en.wikibooks.org",
    url: "https://en.wikibooks.org/wiki/Cookbook:Pancake",
    fixture: "wikibooks-pancakes.html",
    title: /pancake/i,
    minIngredients: 5,
    minSteps: 3,
    extractor: "html",
  },
  {
    id: "plain-blog",
    host: "example-blog.test",
    url: "https://example-blog.test/weeknight-tomato-pasta/",
    fixture: "plain-blog-tomato-pasta.html",
    title: /tomato pasta/i,
    minIngredients: 5,
    minSteps: 3,
    extractor: "html",
  },
];
