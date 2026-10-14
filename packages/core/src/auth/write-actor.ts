/**
 * Resolve who performed a write when the caller may be a household member
 * or a household API key (userId is null for key auth).
 *
 * `created_by` / `set_by` stay user UUIDs so existing FKs keep working:
 * API-key writes are attributed to the member who minted the key.
 * `createdByApiKeyId` records the key itself when one was used.
 */

export type WriteActorSource = {
  userId?: string | null;
  apiKeyId?: string | null;
  apiKeyCreatedBy?: string | null;
};

export type WriteActor = {
  createdBy: string;
  setBy: string;
  createdByApiKeyId: string | null;
};

export class WriteActorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteActorError";
  }
}

export function resolveWriteActor(source: WriteActorSource): WriteActor {
  const createdByApiKeyId = source.apiKeyId ?? null;
  const owningUserId = source.userId ?? source.apiKeyCreatedBy ?? null;

  if (!owningUserId) {
    throw new WriteActorError(
      "This write requires a user actor. API keys must have an owning user (the household member who created the key)."
    );
  }

  return {
    createdBy: owningUserId,
    setBy: owningUserId,
    createdByApiKeyId,
  };
}
