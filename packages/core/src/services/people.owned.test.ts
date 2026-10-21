import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HouseholdAccessError } from "./kitchen-access";
import { PeopleService } from "./people";

function dbReturning(ids: string[]) {
  return {
    select: () => ({
      from: () => ({
        where: async () => ids.map((id) => ({ id })),
      }),
    }),
  };
}

describe("PeopleService.requireOwnedPersonIds", () => {
  it("rejects a person that is not in this kitchen", async () => {
    const service = new PeopleService(dbReturning([]) as never);
    await expect(
      service.requireOwnedPersonIds("kitchen-b", ["550e8400-e29b-41d4-a716-446655440000"])
    ).rejects.toBeInstanceOf(HouseholdAccessError);
  });

  it("allows people that are all in this kitchen", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const service = new PeopleService(dbReturning([id]) as never);
    await expect(
      service.requireOwnedPersonIds("kitchen-b", [id, id, null])
    ).resolves.toBeUndefined();
  });

  it("allows a soft-deleted person in this kitchen", async () => {
    const src = readFileSync(new URL("./people.ts", import.meta.url), "utf8");
    const body = src.slice(
      src.indexOf("async requireOwnedPersonIds"),
      src.indexOf("async listPeopleByHousehold")
    );
    expect(body).not.toMatch(/deletedAt/);

    const id = "550e8400-e29b-41d4-a716-446655440000";
    const service = new PeopleService(dbReturning([id]) as never);
    await expect(service.requireOwnedPersonIds("kitchen-b", [id])).resolves.toBeUndefined();
  });
});
