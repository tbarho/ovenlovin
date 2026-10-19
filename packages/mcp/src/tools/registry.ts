import { searchRecipesTool } from "./search-recipes";
import { getRecipeTool } from "./get-recipe";
import { importRecipeTool } from "./import-recipe";
import { importRecipeFromImageTool } from "./import-recipe-from-image";
import { getHouseholdContextTool } from "./get-household-context";
import { getPersonRulesTool } from "./get-person-rules";
import { checkMealPlanTool } from "./check-meal-plan";
import { exportShoppingListTool } from "./export-shopping-list";
import { saveMealPlanTool } from "./save-meal-plan";
import { getMealPlanTool } from "./get-meal-plan";
import { editMealPlanTool } from "./edit-meal-plan";
import { listCookbooksTool } from "./list-cookbooks";
import { getCookbookTool } from "./get-cookbook";
import { manageCookbookTool } from "./manage-cookbook";
import { managePersonLovesTool } from "./manage-person-loves";
import { reorderPeopleTool } from "./reorder-people";
import { whoamiTool } from "./whoami";
import { createRecipeTool } from "./create-recipe";
import { deleteRecipeTool } from "./delete-recipe";
import { deleteMealPlanTool } from "./delete-meal-plan";
import { managePeopleTool } from "./manage-people";
import { managePersonRulesTool } from "./manage-person-rules";
import { manageHouseholdScheduleTool } from "./manage-household-schedule";
import { manageHouseholdSettingsTool } from "./manage-household-settings";
import { manageKitchenInvitesTool } from "./manage-kitchen-invites";
import { manageKitchenMembersTool } from "./manage-kitchen-members";

export const MCP_TOOLS = [
  whoamiTool,
  searchRecipesTool,
  getRecipeTool,
  createRecipeTool,
  importRecipeTool,
  importRecipeFromImageTool,
  deleteRecipeTool,
  getHouseholdContextTool,
  manageHouseholdScheduleTool,
  manageHouseholdSettingsTool,
  manageKitchenInvitesTool,
  manageKitchenMembersTool,
  getPersonRulesTool,
  managePeopleTool,
  managePersonRulesTool,
  managePersonLovesTool,
  checkMealPlanTool,
  exportShoppingListTool,
  saveMealPlanTool,
  getMealPlanTool,
  editMealPlanTool,
  deleteMealPlanTool,
  listCookbooksTool,
  getCookbookTool,
  manageCookbookTool,
  reorderPeopleTool,
] as const;

export type RegisteredTool = (typeof MCP_TOOLS)[number];
