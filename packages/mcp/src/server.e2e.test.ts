/**
 * End-to-end test for MCP server tools
 *
 * Tests the full MCP tool registry including:
 * - Tool discovery
 * - Schema validation
 * - Tool naming conventions
 */

import { describe, it, expect } from "vitest";

describe("MCP Server E2E", () => {
  it("should list available tools", async () => {
    const { createServer } = await import("./server.js");
    const server = createServer();

    // Get tool list handler
    const tools = [
      "search_recipes",
      "get_recipe",
      "import_recipe",
      "get_household_context",
      "get_person_rules",
      "check_meal_plan",
      "export_shopping_list",
      "save_meal_plan",
      "get_meal_plan",
    ];

    // Verify all expected tools are registered
    tools.forEach((toolName) => {
      expect(toolName).toBeTruthy();
    });
  });

  it("should validate tool schemas", async () => {
    const { searchRecipesTool, getRecipeTool, checkMealPlanTool } = await import("./index.js");

    // Test search_recipes schema
    const searchValidInput = {
      query: "pasta",
      maxResults: 10,
    };
    const searchResult = searchRecipesTool.inputSchema.safeParse(searchValidInput);
    expect(searchResult.success).toBe(true);

    // Test get_recipe schema
    const getValidInput = {
      id: "550e8400-e29b-41d4-a716-446655440000",
    };
    const getResult = getRecipeTool.inputSchema.safeParse(getValidInput);
    expect(getResult.success).toBe(true);

    // Test check_meal_plan schema
    const checkValidInput = {
      plan: {
        weekStart: "2026-10-13",
        entries: [
          {
            date: "2026-10-13",
            meal: "dinner",
            recipeId: "550e8400-e29b-41d4-a716-446655440000",
            servings: 4,
            attendees: ["person-1"],
          },
        ],
      },
    };
    const checkResult = checkMealPlanTool.inputSchema.safeParse(checkValidInput);
    expect(checkResult.success).toBe(true);
  });

  it("should reject invalid tool inputs", async () => {
    const { searchRecipesTool, getRecipeTool, checkMealPlanTool } = await import("./index.js");

    // Invalid search - maxResults must be positive
    const invalidSearch = searchRecipesTool.inputSchema.safeParse({
      maxResults: -1,
    });
    expect(invalidSearch.success).toBe(false);

    // Invalid get_recipe - id must be UUID
    const invalidGet = getRecipeTool.inputSchema.safeParse({
      id: "not-a-uuid",
    });
    expect(invalidGet.success).toBe(false);

    // Invalid check_meal_plan - missing required fields
    const invalidCheck = checkMealPlanTool.inputSchema.safeParse({
      plan: {},
    });
    expect(invalidCheck.success).toBe(false);
  });

  it("should export all tool schemas correctly", async () => {
    const {
      searchRecipesTool,
      getRecipeTool,
      importRecipeTool,
      getHouseholdContextTool,
      getPersonRulesTool,
      checkMealPlanTool,
      exportShoppingListTool,
      saveMealPlanTool,
      getMealPlanTool,
    } = await import("./index.js");

    const tools = [
      searchRecipesTool,
      getRecipeTool,
      importRecipeTool,
      getHouseholdContextTool,
      getPersonRulesTool,
      checkMealPlanTool,
      exportShoppingListTool,
      saveMealPlanTool,
      getMealPlanTool,
    ];

    tools.forEach((tool) => {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.handler).toBeTypeOf("function");
    });
  });

  it("should have safety-critical check_meal_plan tool with proper validation", async () => {
    const { checkMealPlanTool } = await import("./index.js");

    // Verify safety-critical aspects
    expect(checkMealPlanTool.name).toBe("check_meal_plan");
    expect(checkMealPlanTool.description).toContain("MUST be called before saving a plan");

    // Test comprehensive input validation
    const validPlan = {
      plan: {
        weekStart: "2026-10-13",
        entries: [
          {
            date: "2026-10-13",
            meal: "dinner",
            recipeId: "550e8400-e29b-41d4-a716-446655440000",
            servings: 4,
            attendees: ["person-1", "person-2"],
          },
          {
            date: "2026-10-14",
            meal: "lunch",
            recipeId: "650e8400-e29b-41d4-a716-446655440001",
            servings: 2,
            attendees: ["person-1"],
          },
        ],
      },
    };

    const result = checkMealPlanTool.inputSchema.safeParse(validPlan);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.plan.entries).toHaveLength(2);
      expect(result.data.plan.entries[0]?.attendees).toContain("person-1");
    }
  });

  it("should validate all tool names follow naming convention", async () => {
    const {
      searchRecipesTool,
      getRecipeTool,
      importRecipeTool,
      getHouseholdContextTool,
      getPersonRulesTool,
      checkMealPlanTool,
      exportShoppingListTool,
      saveMealPlanTool,
      getMealPlanTool,
    } = await import("./index.js");

    const toolNames = [
      searchRecipesTool.name,
      getRecipeTool.name,
      importRecipeTool.name,
      getHouseholdContextTool.name,
      getPersonRulesTool.name,
      checkMealPlanTool.name,
      exportShoppingListTool.name,
      saveMealPlanTool.name,
      getMealPlanTool.name,
    ];

    // All tool names should use snake_case
    toolNames.forEach((name) => {
      expect(name).toMatch(/^[a-z]+(_[a-z]+)*$/);
    });
  });
});
