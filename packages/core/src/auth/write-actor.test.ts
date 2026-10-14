import { describe, expect, it } from "vitest";
import { resolveWriteActor, WriteActorError } from "./write-actor";

const USER_ID = "550e8400-e29b-41d4-a716-446655440001";
const KEY_ID = "550e8400-e29b-41d4-a716-4466554400aa";
const KEY_OWNER_ID = "550e8400-e29b-41d4-a716-4466554400bb";

describe("resolveWriteActor", () => {
  it("attributes a signed-in user write to that user", () => {
    expect(resolveWriteActor({ userId: USER_ID })).toEqual({
      createdBy: USER_ID,
      setBy: USER_ID,
      createdByApiKeyId: null,
    });
  });

  it("attributes an API-key write to the key's owning user and records the key", () => {
    expect(
      resolveWriteActor({
        apiKeyId: KEY_ID,
        apiKeyCreatedBy: KEY_OWNER_ID,
      })
    ).toEqual({
      createdBy: KEY_OWNER_ID,
      setBy: KEY_OWNER_ID,
      createdByApiKeyId: KEY_ID,
    });
  });

  it("prefers the session user over the key owner when both are present", () => {
    expect(
      resolveWriteActor({
        userId: USER_ID,
        apiKeyId: KEY_ID,
        apiKeyCreatedBy: KEY_OWNER_ID,
      })
    ).toEqual({
      createdBy: USER_ID,
      setBy: USER_ID,
      createdByApiKeyId: KEY_ID,
    });
  });

  it("rejects an API key with no owning user (set_by must stay a user row)", () => {
    expect(() => resolveWriteActor({ apiKeyId: KEY_ID })).toThrow(WriteActorError);
    expect(() => resolveWriteActor({ apiKeyId: KEY_ID })).toThrow(/owning user/i);
  });

  it("rejects a caller with no user and no API key", () => {
    expect(() => resolveWriteActor({})).toThrow(WriteActorError);
  });
});
