// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"agents.mdx": () => import("../src/content/docs/agents.mdx?collection=docs"), "concepts.mdx": () => import("../src/content/docs/concepts.mdx?collection=docs"), "index.mdx": () => import("../src/content/docs/index.mdx?collection=docs"), "quickstart.mdx": () => import("../src/content/docs/quickstart.mdx?collection=docs"), "reference/api/index.mdx": () => import("../src/content/docs/reference/api/index.mdx?collection=docs"), "reference/index.mdx": () => import("../src/content/docs/reference/index.mdx?collection=docs"), "reference/mcp/check-meal-plan.mdx": () => import("../src/content/docs/reference/mcp/check-meal-plan.mdx?collection=docs"), "reference/mcp/export-shopping-list.mdx": () => import("../src/content/docs/reference/mcp/export-shopping-list.mdx?collection=docs"), "reference/mcp/get-household-context.mdx": () => import("../src/content/docs/reference/mcp/get-household-context.mdx?collection=docs"), "reference/mcp/get-meal-plan.mdx": () => import("../src/content/docs/reference/mcp/get-meal-plan.mdx?collection=docs"), "reference/mcp/get-person-rules.mdx": () => import("../src/content/docs/reference/mcp/get-person-rules.mdx?collection=docs"), "reference/mcp/get-recipe.mdx": () => import("../src/content/docs/reference/mcp/get-recipe.mdx?collection=docs"), "reference/mcp/import-recipe.mdx": () => import("../src/content/docs/reference/mcp/import-recipe.mdx?collection=docs"), "reference/mcp/save-meal-plan.mdx": () => import("../src/content/docs/reference/mcp/save-meal-plan.mdx?collection=docs"), "reference/mcp/search-recipes.mdx": () => import("../src/content/docs/reference/mcp/search-recipes.mdx?collection=docs"), }),
};
export default browserCollections;