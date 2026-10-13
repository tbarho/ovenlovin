import { describe, it, expect, beforeEach, vi } from "vitest";
import { toPublicApiKey, toPublicApiKeyWithPlaintext } from "../schemas/households";
import { ApiKeyService } from "./api-keys";
import type { DbClient } from "@ovenlovin/db/client";

const mockDb = {
  insert: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
} as unknown as DbClient;

describe("ApiKeyService", () => {
  let service: ApiKeyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApiKeyService(mockDb);
  });

  describe("create", () => {
    it("should create an API key with hashed value", async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Test Key",
            keyHash: "hash",
            keyPrefix: "rkapi_ab",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
        ]),
      };

      (mockDb.insert as any) = vi.fn().mockReturnValue(mockInsert);

      const result = await service.create(
        {
          householdId: "household-123",
          name: "Test Key",
          scopes: ["recipes:read"],
        },
        "user-123"
      );

      expect(result).toHaveProperty("plaintext");
      expect(result.plaintext).toMatch(/^rkapi_[a-f0-9]{64}$/);
      expect(result.keyPrefix).toBe("rkapi_ab");
      expect(result.name).toBe("Test Key");
      expect(result.scopes).toEqual(["recipes:read"]);
    });

    it("should support expiration date", async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Expiring Key",
            keyHash: "hash",
            keyPrefix: "rkapi_ab",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: new Date("2024-12-31"),
            revokedAt: null,
          },
        ]),
      };

      (mockDb.insert as any) = vi.fn().mockReturnValue(mockInsert);

      const result = await service.create(
        {
          householdId: "household-123",
          name: "Expiring Key",
          scopes: ["recipes:read"],
          expiresAt: "2024-12-31T00:00:00.000Z",
        },
        "user-123"
      );

      expect(result.expiresAt).toBe("2024-12-31T00:00:00.000Z");
    });
  });

  describe("validate", () => {
    it("should validate a correct API key", async () => {
      const plaintext = "rkapi_" + "a".repeat(64);
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Test Key",
            keyHash: service["hashKey"](plaintext),
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
        ]),
      };

      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);
      (mockDb.update as any) = vi.fn().mockReturnValue(mockUpdate);

      const result = await service.validate(plaintext);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.key.id).toBe("key-123");
        expect(result.key.householdId).toBe("household-123");
      }
    });

    it("should reject an invalid API key", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.validate("rkapi_invalid");

      expect(result.valid).toBe(false);
    });

    it("should reject a revoked API key", async () => {
      const plaintext = "rkapi_" + "a".repeat(64);
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Test Key",
            keyHash: service["hashKey"](plaintext),
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: new Date("2024-01-02"),
          },
        ]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.validate(plaintext);

      expect(result.valid).toBe(false);
    });

    it("should reject an expired API key", async () => {
      const plaintext = "rkapi_" + "a".repeat(64);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Test Key",
            keyHash: service["hashKey"](plaintext),
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: yesterday,
            revokedAt: null,
          },
        ]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.validate(plaintext);

      expect(result.valid).toBe(false);
    });

    it("should reject a soft-deleted API key", async () => {
      const plaintext = "rkapi_" + "a".repeat(64);
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            id: "key-123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: new Date("2024-01-02"),
            createdBy: "user-123",
            householdId: "household-123",
            name: "Test Key",
            keyHash: service["hashKey"](plaintext),
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
        ]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.validate(plaintext);

      expect(result.valid).toBe(false);
    });
  });

  describe("revoke", () => {
    it("should revoke an API key", async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "key-123" }]),
      };

      (mockDb.update as any) = vi.fn().mockReturnValue(mockUpdate);

      const revoked = await service.revoke("key-123", "household-123");

      expect(revoked).toBe(true);
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) })
      );
    });
  });

  describe("listForHousehold", () => {
    it("should list API keys for a household", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: "key-1",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Key 1",
            keyHash: "hash1",
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
          {
            id: "key-2",
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Key 2",
            keyHash: "hash2",
            keyPrefix: "rkapi_bb",
            scopes: ["recipes:read", "recipes:write"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
        ]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.listForHousehold("household-123");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Key 2");
      expect(result[1].name).toBe("Key 1");
    });

    it("omits soft-deleted keys and keeps hashing out of the public shape helper", async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: "key-1",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
            deletedAt: new Date("2024-01-03"),
            createdBy: "user-123",
            householdId: "household-123",
            name: "Deleted",
            keyHash: "hash1",
            keyPrefix: "rkapi_aa",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
          {
            id: "key-2",
            createdAt: new Date("2024-01-02"),
            updatedAt: new Date("2024-01-02"),
            deletedAt: null,
            createdBy: "user-123",
            householdId: "household-123",
            name: "Active",
            keyHash: "hash2",
            keyPrefix: "rkapi_bb",
            scopes: ["recipes:read"],
            lastUsedAt: null,
            expiresAt: null,
            revokedAt: null,
          },
        ]),
      };

      (mockDb.select as any) = vi.fn().mockReturnValue(mockSelect);

      const result = await service.listForHousehold("household-123");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Active");
    });
  });

  describe("public presentation", () => {
    it("strips the hash and keeps the masked prefix fields", () => {
      const key = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        deletedAt: null,
        createdBy: "550e8400-e29b-41d4-a716-446655440001",
        householdId: "550e8400-e29b-41d4-a716-446655440002",
        name: "Grok",
        keyHash: "should-not-leak",
        keyPrefix: "rkapi_ab",
        scopes: ["recipes:read"] as const,
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: null,
      };

      const pub = toPublicApiKey(key);
      expect(pub).not.toHaveProperty("keyHash");
      expect(pub.keyPrefix).toBe("rkapi_ab");
      expect(pub.name).toBe("Grok");

      const withSecret = toPublicApiKeyWithPlaintext({ ...key, plaintext: "rkapi_secret" });
      expect(withSecret).not.toHaveProperty("keyHash");
      expect(withSecret.plaintext).toBe("rkapi_secret");
    });
  });
});
