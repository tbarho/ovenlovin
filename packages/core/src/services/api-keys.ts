import { createHash, randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { apiKey } from "@ovenlovin/db/schema";
import type { DbClient } from "@ovenlovin/db/client";
import { BaseService } from "./base";
import type {
  ApiKey,
  ApiKeyScope,
  ApiKeyWithPlaintext,
  CreateApiKeyInput,
} from "../schemas/households";

export class ApiKeyService extends BaseService {
  constructor(db: DbClient) {
    super(db);
  }

  async create(input: CreateApiKeyInput, createdBy: string): Promise<ApiKeyWithPlaintext> {
    const plaintext = this.generateKey();
    const keyHash = this.hashKey(plaintext);
    const keyPrefix = plaintext.slice(0, 8);

    const [created] = await this._db
      .insert(apiKey)
      .values({
        householdId: input.householdId,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        createdBy,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create API key");
    }

    return {
      id: created.id,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      deletedAt: created.deletedAt?.toISOString() ?? null,
      createdBy: created.createdBy,
      householdId: created.householdId,
      name: created.name,
      keyHash: created.keyHash,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes as ApiKeyScope[],
      lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
      expiresAt: created.expiresAt?.toISOString() ?? null,
      revokedAt: created.revokedAt?.toISOString() ?? null,
      plaintext,
    };
  }

  async validate(plaintext: string): Promise<{ valid: false } | { valid: true; key: ApiKey }> {
    const keyHash = this.hashKey(plaintext);

    const [found] = await this._db
      .select()
      .from(apiKey)
      .where(eq(apiKey.keyHash, keyHash))
      .limit(1);

    if (!found) {
      return { valid: false };
    }

    if (found.deletedAt) {
      return { valid: false };
    }

    if (found.revokedAt) {
      return { valid: false };
    }

    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      return { valid: false };
    }

    await this._db.update(apiKey).set({ lastUsedAt: new Date() }).where(eq(apiKey.id, found.id));

    const key: ApiKey = {
      id: found.id,
      createdAt: found.createdAt.toISOString(),
      updatedAt: found.updatedAt.toISOString(),
      deletedAt: null,
      createdBy: found.createdBy,
      householdId: found.householdId,
      name: found.name,
      keyHash: found.keyHash,
      keyPrefix: found.keyPrefix,
      scopes: found.scopes as ApiKeyScope[],
      lastUsedAt: found.lastUsedAt ? found.lastUsedAt.toISOString() : null,
      expiresAt: found.expiresAt ? found.expiresAt.toISOString() : null,
      revokedAt: null,
    };

    return {
      valid: true,
      key,
    };
  }

  async revoke(keyId: string, householdId: string): Promise<boolean> {
    const [updated] = await this._db
      .update(apiKey)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKey.id, keyId), eq(apiKey.householdId, householdId)))
      .returning({ id: apiKey.id });

    return Boolean(updated);
  }

  async listForHousehold(householdId: string): Promise<ApiKey[]> {
    const keys = await this._db.select().from(apiKey).where(eq(apiKey.householdId, householdId));

    return keys
      .filter((k) => !k.deletedAt)
      .map((k) => ({
        id: k.id,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString(),
        deletedAt: null,
        createdBy: k.createdBy,
        householdId: k.householdId,
        name: k.name,
        keyHash: k.keyHash,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes as ApiKeyScope[],
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }

  private generateKey(): string {
    const bytes = randomBytes(32);
    return `rkapi_${bytes.toString("hex")}`;
  }

  /** SHA-256 hex digest. Keep this hashing as-is — callers never store plaintext. */
  private hashKey(plaintext: string): string {
    return createHash("sha256").update(plaintext).digest("hex");
  }
}
