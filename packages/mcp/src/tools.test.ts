/**
 * Unit tests for MCP tool schemas
 */

import { describe, it, expect } from "vitest";
import {
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
  whoamiTool,
  createRecipeTool,
  deleteRecipeTool,
  deleteMealPlanTool,
  managePeopleTool,
  managePersonRulesTool,
  manageHouseholdScheduleTool,
} from "./index.js";

describe("MCP Tool Schemas", () => {
  describe("search_recipes", () => {
    it("validates correct input", () => {
      const result = searchRecipesTool.inputSchema.safeParse({
        query: "pasta",
        maxResults: 10,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative maxResults", () => {
      const result = searchRecipesTool.inputSchema.safeParse({
        maxResults: -1,
      });
      expect(result.success).toBe(false);
    });

    it("applies default maxResults", () => {
      const result = searchRecipesTool.inputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxResults).toBe(20);
      }
    });

    it("documents hiddenCount/hidden when forAttendees hides a recipe", () => {
      expect(searchRecipesTool.description).toMatch(/hiddenCount/);
      expect(searchRecipesTool.description).toMatch(/hidden/);
    });
  });

  describe("get_recipe", () => {
    it("validates correct UUID", () => {
      const result = getRecipeTool.inputSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const result = getRecipeTool.inputSchema.safeParse({
        id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("check_meal_plan", () => {
    it("validates correct plan structure", () => {
      const result = checkMealPlanTool.inputSchema.safeParse({
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
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const result = checkMealPlanTool.inputSchema.safeParse({
        plan: {
          weekStart: "invalid-date",
          entries: [],
        },
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing plan", () => {
      const result = checkMealPlanTool.inputSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("get_person_rules", () => {
    it("validates correct input", () => {
      const result = getPersonRulesTool.inputSchema.safeParse({
        personIds: ["person-1", "person-2"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty personIds", () => {
      const result = getPersonRulesTool.inputSchema.safeParse({
        personIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("applies default includeInactive", () => {
      const result = getPersonRulesTool.inputSchema.safeParse({
        personIds: ["person-1"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeInactive).toBe(false);
      }
    });
  });

  describe("save_meal_plan", () => {
    it("validates correct input", () => {
      const result = saveMealPlanTool.inputSchema.safeParse({
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
        checkReportJson: { status: "complete" },
      });
      expect(result.success).toBe(true);
    });

    it("applies default status", () => {
      const result = saveMealPlanTool.inputSchema.safeParse({
        weekStart: "2026-10-13",
        entries: [],
        checkReportJson: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("draft");
      }
    });
  });

  describe("export_shopping_list", () => {
    it("validates correct input", () => {
      const result = exportShoppingListTool.inputSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("applies default format", () => {
      const result = exportShoppingListTool.inputSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe("markdown");
        expect(result.data.groupBy).toBe("aisle");
      }
    });

    it("validates format enum", () => {
      const result = exportShoppingListTool.inputSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
        format: "invalid-format",
      });
      expect(result.success).toBe(false);
    });

    it("accepts includeStaples and the includePantryItems alias", () => {
      const canonical = exportShoppingListTool.inputSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
        includeStaples: true,
      });
      expect(canonical.success).toBe(true);
      if (canonical.success) {
        expect(canonical.data.includeStaples).toBe(true);
      }

      const alias = exportShoppingListTool.inputSchema.safeParse({
        planId: "550e8400-e29b-41d4-a716-446655440000",
        includePantryItems: true,
      });
      expect(alias.success).toBe(true);
      if (alias.success) {
        expect(alias.data.includePantryItems).toBe(true);
        expect(alias.data.includeStaples).toBeUndefined();
      }
    });
  });

  describe("import_recipe", () => {
    it("validates URL source", () => {
      const result = importRecipeTool.inputSchema.safeParse({
        source: "url",
        content: "https://example.com/recipe",
      });
      expect(result.success).toBe(true);
    });

    it("validates paste source", () => {
      const result = importRecipeTool.inputSchema.safeParse({
        source: "paste",
        content: "Recipe text...",
      });
      expect(result.success).toBe(true);
    });

    it("defaults includeSource to true", () => {
      const result = getRecipeTool.inputSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeSource).toBe(true);
      }
    });
  });

  describe("cookbooks", () => {
    it("validates list_cookbooks defaults", () => {
      const result = listCookbooksTool.inputSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeEmpty).toBe(true);
      }
    });

    it("validates get_cookbook id", () => {
      expect(
        getCookbookTool.inputSchema.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440000",
        }).success
      ).toBe(true);
    });

    it("validates reorder_people ids", () => {
      expect(
        reorderPeopleTool.inputSchema.safeParse({
          personIds: [
            "550e8400-e29b-41d4-a716-446655440000",
            "550e8400-e29b-41d4-a716-446655440001",
          ],
        }).success
      ).toBe(true);
      expect(reorderPeopleTool.inputSchema.safeParse({ personIds: [] }).success).toBe(false);
    });

    it("validates manage_person_loves actions", () => {
      expect(
        managePersonLovesTool.inputSchema.safeParse({
          action: "add",
          personId: "550e8400-e29b-41d4-a716-446655440000",
          value: "salmon",
        }).success
      ).toBe(true);
      expect(
        managePersonLovesTool.inputSchema.safeParse({
          action: "list",
          personId: "not-a-uuid",
        }).success
      ).toBe(false);
    });

    it("validates manage_cookbook actions", () => {
      expect(
        manageCookbookTool.inputSchema.safeParse({
          action: "create",
          name: "Weeknight dinners",
        }).success
      ).toBe(true);
      expect(
        manageCookbookTool.inputSchema.safeParse({
          action: "add_recipe",
          id: "550e8400-e29b-41d4-a716-446655440000",
          recipeId: "550e8400-e29b-41d4-a716-446655440001",
        }).success
      ).toBe(true);
    });
  });

  describe("new agent tools", () => {
    it("validates whoami", () => {
      expect(whoamiTool.inputSchema.safeParse({}).success).toBe(true);
    });

    it("validates create_recipe", () => {
      expect(
        createRecipeTool.inputSchema.safeParse({
          title: "Toast",
          notes: "Use leftover bread.",
          ingredients: [{ rawText: "1 slice bread" }],
          steps: [{ text: "Toast it." }],
        }).success
      ).toBe(true);
      expect(createRecipeTool.inputSchema.safeParse({ title: "" }).success).toBe(false);
    });

    it("validates delete tools", () => {
      expect(
        deleteRecipeTool.inputSchema.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440000",
        }).success
      ).toBe(true);
      expect(
        deleteMealPlanTool.inputSchema.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440000",
        }).success
      ).toBe(true);
    });

    it("validates manage_people and manage_person_rules", () => {
      expect(managePeopleTool.inputSchema.safeParse({ action: "list" }).success).toBe(true);
      expect(
        managePeopleTool.inputSchema.safeParse({ action: "create", displayName: "Parent A" })
          .success
      ).toBe(true);
      expect(
        managePersonRulesTool.inputSchema.safeParse({
          action: "add",
          personId: "550e8400-e29b-41d4-a716-446655440000",
          kind: "allergen",
          target: "peanut",
          severity: "block",
        }).success
      ).toBe(true);
      expect(
        managePersonRulesTool.inputSchema.safeParse({
          action: "add",
          personId: "550e8400-e29b-41d4-a716-446655440000",
          kind: "allergen",
          target: "tree_nut",
          severity: "block",
          treatCoconutAsTreeNut: true,
        }).success
      ).toBe(true);
    });

    it("validates manage_household_schedule", () => {
      expect(manageHouseholdScheduleTool.inputSchema.safeParse({}).success).toBe(true);
      expect(
        manageHouseholdScheduleTool.inputSchema.safeParse({
          action: "replace",
          week: [{ day: "friday", busyLevel: "high", cooking: false }],
        }).success
      ).toBe(true);
    });
  });

  describe("import_recipe extra", () => {
    it("applies default skipReview", () => {
      const result = importRecipeTool.inputSchema.safeParse({
        source: "url",
        content: "https://example.com/recipe",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.skipReview).toBe(false);
      }
    });
  });
});
