import { describe, it, expect } from "vitest";
import { paginationQuerySchema, paginatedResponseSchema, uuidSchema } from "./common";

describe("common schemas", () => {
  describe("uuidSchema", () => {
    it("validates valid UUIDs", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
    });

    it("rejects invalid UUIDs", () => {
      expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    });
  });

  describe("paginationQuerySchema", () => {
    it("uses default limit", () => {
      const result = paginationQuerySchema.parse({});
      expect(result.limit).toBe(20);
    });

    it("respects custom limit", () => {
      const result = paginationQuerySchema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it("rejects limit over 100", () => {
      expect(() => paginationQuerySchema.parse({ limit: 150 })).toThrow();
    });

    it("accepts cursor", () => {
      const result = paginationQuerySchema.parse({
        cursor: "next-page-token",
      });
      expect(result.cursor).toBe("next-page-token");
    });
  });

  describe("paginatedResponseSchema", () => {
    it("validates paginated response", () => {
      const schema = paginatedResponseSchema(uuidSchema);
      const response = schema.parse({
        items: ["550e8400-e29b-41d4-a716-446655440000"],
        nextCursor: "next",
        hasMore: true,
      });
      expect(response.items).toHaveLength(1);
      expect(response.hasMore).toBe(true);
    });
  });
});
