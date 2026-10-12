import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PATCH, DELETE } from "../[id]/rules/[ruleId]/route";
import { NextRequest } from "next/server";
import { PeopleService } from "@ovenlovin/core";

vi.mock("@ovenlovin/db", () => ({
  getDatabase: vi.fn(() => ({} as any)),
}));

vi.mock("@/lib/api/middleware", () => ({
  getRequestContext: vi.fn(async () => ({
    userId: "test-user-id",
    householdId: "test-household-id",
  })),
  requireHouseholdId: vi.fn((context) => context.householdId),
}));

vi.mock("@ovenlovin/core", () => {
  const mockPeopleService = {
    getPerson: vi.fn(),
    getRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  };

  return {
    PeopleService: vi.fn(() => mockPeopleService),
  };
});

describe("Person Rules [ruleId] API", () => {
  let mockPeopleService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const PeopleServiceMock = PeopleService as any;
    mockPeopleService = new PeopleServiceMock();
  });

  describe("GET /api/v1/people/:id/rules/:ruleId", () => {
    it("returns rule when found", async () => {
      const mockPerson = {
        id: "person-123",
        displayName: "Test Person",
        householdId: "test-household-id",
      };

      const mockRule = {
        id: "rule-456",
        personId: "person-123",
        kind: "allergen",
        target: "peanuts",
        severity: "block",
        includeMayContain: false,
        includeCrossContact: false,
        sharedFacility: "ignore",
        includeUnmappedIngredients: false,
        includeDescendants: true,
        treatCoconutAsTreeNut: true,
        label: null,
        note: null,
        activeFrom: null,
        activeUntil: null,
        setBy: "parent",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        deletedAt: null,
        createdBy: "test-user-id",
      };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockRule);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456");
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockRule);
      expect(mockPeopleService.getPerson).toHaveBeenCalledWith("person-123");
      expect(mockPeopleService.getRule).toHaveBeenCalledWith("rule-456");
    });

    it("returns 404 when person not found", async () => {
      mockPeopleService.getPerson.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456");
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule not found", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456");
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule belongs to different person", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };
      const mockRule = { id: "rule-456", personId: "different-person" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockRule);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456");
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await GET(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/people/:id/rules/:ruleId", () => {
    it("updates rule successfully", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };
      const mockExistingRule = {
        id: "rule-456",
        personId: "person-123",
        kind: "allergen",
        target: "peanuts",
        severity: "block",
      };
      const mockUpdatedRule = {
        ...mockExistingRule,
        severity: "warn",
        note: "Updated note",
      };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockExistingRule);
      mockPeopleService.updateRule.mockResolvedValue(mockUpdatedRule);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "PATCH",
        body: JSON.stringify({ severity: "warn", note: "Updated note" }),
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await PATCH(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockUpdatedRule);
      expect(mockPeopleService.updateRule).toHaveBeenCalledWith("rule-456", {
        severity: "warn",
        note: "Updated note",
      });
    });

    it("returns 404 when person not found", async () => {
      mockPeopleService.getPerson.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "PATCH",
        body: JSON.stringify({ severity: "warn" }),
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule not found", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "PATCH",
        body: JSON.stringify({ severity: "warn" }),
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule belongs to different person", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };
      const mockRule = { id: "rule-456", personId: "different-person" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockRule);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "PATCH",
        body: JSON.stringify({ severity: "warn" }),
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await PATCH(request, { params });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/people/:id/rules/:ruleId", () => {
    it("deletes rule successfully", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };
      const mockRule = { id: "rule-456", personId: "person-123" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockRule);
      mockPeopleService.deleteRule.mockResolvedValue(true);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(204);
      expect(mockPeopleService.deleteRule).toHaveBeenCalledWith("rule-456");
    });

    it("returns 404 when person not found", async () => {
      mockPeopleService.getPerson.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule not found", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    it("returns 404 when rule belongs to different person", async () => {
      const mockPerson = { id: "person-123", householdId: "test-household-id" };
      const mockRule = { id: "rule-456", personId: "different-person" };

      mockPeopleService.getPerson.mockResolvedValue(mockPerson);
      mockPeopleService.getRule.mockResolvedValue(mockRule);

      const request = new NextRequest("http://localhost:3000/api/v1/people/person-123/rules/rule-456", {
        method: "DELETE",
      });
      const params = Promise.resolve({ id: "person-123", ruleId: "rule-456" });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });
  });
});
