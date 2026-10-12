// @ts-nocheck
import * as __fd_glob_18 from "../src/content/docs/reference/mcp/search-recipes.mdx?collection=docs"
import * as __fd_glob_17 from "../src/content/docs/reference/mcp/save-meal-plan.mdx?collection=docs"
import * as __fd_glob_16 from "../src/content/docs/reference/mcp/import-recipe.mdx?collection=docs"
import * as __fd_glob_15 from "../src/content/docs/reference/mcp/get-recipe.mdx?collection=docs"
import * as __fd_glob_14 from "../src/content/docs/reference/mcp/get-person-rules.mdx?collection=docs"
import * as __fd_glob_13 from "../src/content/docs/reference/mcp/get-meal-plan.mdx?collection=docs"
import * as __fd_glob_12 from "../src/content/docs/reference/mcp/get-household-context.mdx?collection=docs"
import * as __fd_glob_11 from "../src/content/docs/reference/mcp/export-shopping-list.mdx?collection=docs"
import * as __fd_glob_10 from "../src/content/docs/reference/mcp/check-meal-plan.mdx?collection=docs"
import * as __fd_glob_9 from "../src/content/docs/reference/index.mdx?collection=docs"
import * as __fd_glob_8 from "../src/content/docs/reference/api/index.mdx?collection=docs"
import * as __fd_glob_7 from "../src/content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_6 from "../src/content/docs/index.mdx?collection=docs"
import * as __fd_glob_5 from "../src/content/docs/concepts.mdx?collection=docs"
import * as __fd_glob_4 from "../src/content/docs/agents.mdx?collection=docs"
import { default as __fd_glob_3 } from "../src/content/docs/reference/meta.json?collection=meta"
import { default as __fd_glob_2 } from "../src/content/docs/reference/mcp/meta.json?collection=meta"
import { default as __fd_glob_1 } from "../src/content/docs/reference/api/meta.json?collection=meta"
import { default as __fd_glob_0 } from "../src/content/docs/meta.json?collection=meta"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();

export const docs = await create.doc("docs", "src/content/docs", {"agents.mdx": __fd_glob_4, "concepts.mdx": __fd_glob_5, "index.mdx": __fd_glob_6, "quickstart.mdx": __fd_glob_7, "reference/api/index.mdx": __fd_glob_8, "reference/index.mdx": __fd_glob_9, "reference/mcp/check-meal-plan.mdx": __fd_glob_10, "reference/mcp/export-shopping-list.mdx": __fd_glob_11, "reference/mcp/get-household-context.mdx": __fd_glob_12, "reference/mcp/get-meal-plan.mdx": __fd_glob_13, "reference/mcp/get-person-rules.mdx": __fd_glob_14, "reference/mcp/get-recipe.mdx": __fd_glob_15, "reference/mcp/import-recipe.mdx": __fd_glob_16, "reference/mcp/save-meal-plan.mdx": __fd_glob_17, "reference/mcp/search-recipes.mdx": __fd_glob_18, });

export const meta = await create.meta("meta", "src/content/docs", {"meta.json": __fd_glob_0, "reference/api/meta.json": __fd_glob_1, "reference/mcp/meta.json": __fd_glob_2, "reference/meta.json": __fd_glob_3, });