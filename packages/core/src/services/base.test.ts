import { describe, it, expect, vi } from "vitest";
import { BaseService } from "./base";

class TestService extends BaseService {
  testEncodeCursor(item: { createdAt: string; id: string }) {
    return this.encodeCursor(item);
  }

  testDecodeCursor(cursor: string) {
    return this.decodeCursor(cursor);
  }

  testBuildPaginatedResponse<T>(items: T[], limit: number, cursor?: string) {
    return this.buildPaginatedResponse(items, limit, cursor);
  }
}

describe("BaseService", () => {
  const mockDb = {} as any;
  const service = new TestService(mockDb);

  describe("cursor encoding/decoding", () => {
    it("encodes and decodes cursor correctly", () => {
      const item = {
        createdAt: "2026-01-01T00:00:00Z",
        id: "550e8400-e29b-41d4-a716-446655440000",
      };

      const encoded = service.testEncodeCursor(item);
      expect(encoded).toBeTruthy();

      const decoded = service.testDecodeCursor(encoded);
      expect(decoded).toEqual(item);
    });
  });

  describe("buildPaginatedResponse", () => {
    it("returns items with hasMore false when under limit", () => {
      const items = [1, 2, 3];
      const result = service.testBuildPaginatedResponse(items, 10);

      expect(result.items).toEqual([1, 2, 3]);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it("returns items with hasMore true when over limit", () => {
      const items = [
        { createdAt: "2026-01-01T00:00:00Z", id: "1", value: 1 },
        { createdAt: "2026-01-02T00:00:00Z", id: "2", value: 2 },
        { createdAt: "2026-01-03T00:00:00Z", id: "3", value: 3 },
      ];
      const result = service.testBuildPaginatedResponse(items, 2);

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeTruthy();
    });
  });
});
