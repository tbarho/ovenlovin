import { searchRecipesTool } from "./search-recipes";
import { getRecipeTool } from "./get-recipe";
import { importRecipeTool } from "./import-recipe";
import { getHouseholdContextTool } from "./get-household-context";
import { getPersonRulesTool } from "./get-person-rules";
import { checkMealPlanTool } from "./check-meal-plan";
import { exportShoppingListTool } from "./export-shopping-list";
import { saveMealPlanTool } from "./save-meal-plan";
import { getMealPlanTool } from "./get-meal-plan";
import { listCookbooksTool } from "./list-cookbooks";
import { getCookbookTool } from "./get-cookbook";
import { manageCookbookTool } from "./manage-cookbook";
import { managePersonLovesTool } from "./manage-person-loves";
import { reorderPeopleTool } from "./reorder-people";

export const MCP_TOOLS = [
  searchRecipesTool,
  getRecipeTool,
  importRecipeTool,
  getHouseholdContextTool,
  getPersonRulesTool,
  checkMealPlanTool,
  exportShoppingListTool,
  saveMealPlanTool,
  getMealPlanTool,
  listCookbooksTool,
  getCookbookTool,
  manageCookbookTool,
  managePersonLovesTool,
  reorderPeopleTool,
] as const;

export type RegisteredTool = (typeof MCP_TOOLS)[number];
