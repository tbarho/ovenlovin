import { describe, expect, it, vi, beforeEach } from "vitest";
import { HouseholdAccessError } from "./kitchen-access";
import { InviteService } from "./invites";

function chain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(async () => result),
    values: vi.fn(() => self),
    set: vi.fn(() => self),
    returning: vi.fn(async () => result),
    innerJoin: vi.fn(() => self),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return self;
}

const householdRow = {
  id: "22222222-2222-4222-8222-222222222222",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
  createdBy: "11111111-1111-4111-8111-111111111111",
  name: "Parent A Kitchen",
  slug: "kitchen-parent-a",
  clerkOrgId: null,
};

function inviteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    deletedAt: null,
    createdBy: "11111111-1111-4111-8111-111111111111",
    householdId: householdRow.id,
    token: "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    role: "member",
    expiresAt: new Date("2026-10-24"),
    revokedAt: null,
    ...overrides,
  };
}

describe("InviteService", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new InviteService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses create/list/revoke unless the actor is owner or admin", async () => {
    await expect(
      service.createInvite(householdRow.id, { role: "member" }, { userId: "u", role: "member" })
    ).rejects.toBeInstanceOf(HouseholdAccessError);
    await expect(service.listPendingInvites(householdRow.id, "viewer")).rejects.toThrow(
      /Owner or admin/
    );
    await expect(
      service.revokeInvite("66666666-6666-4666-8666-666666666666", householdRow.id, "member")
    ).rejects.toThrow(/Owner or admin/);
  });

  it("creates a pending member invite with a shareable token", async () => {
    const created = inviteRow();
    db.select.mockReturnValueOnce(chain([householdRow]));
    db.insert.mockReturnValueOnce(chain([created]));

    const result = await service.createInvite(
      householdRow.id,
      { role: "member", expiresInDays: 7 },
      { userId: "11111111-1111-4111-8111-111111111111", role: "owner" }
    );

    expect(result.role).toBe("member");
    expect(result.householdId).toBe(householdRow.id);
    expect(result.token).toMatch(/^olinv_[a-f0-9]+$/);
    const inserted = db.insert.mock.results[0]?.value as {
      values: { mock: { calls: Array<[Record<string, unknown>]> } };
    };
    expect(inserted.values.mock.calls[0]?.[0]).toMatchObject({
      householdId: householdRow.id,
      role: "member",
      createdBy: "11111111-1111-4111-8111-111111111111",
    });
    expect(String(inserted.values.mock.calls[0]?.[0]?.token)).toMatch(/^olinv_[a-f0-9]{48}$/);
  });

  it("lists only pending invites and revokes one", async () => {
    const pending = inviteRow();
    const expired = inviteRow({
      id: "77777777-7777-4777-8777-777777777777",
      expiresAt: new Date("2026-01-01"),
    });
    const revoked = inviteRow({
      id: "88888888-8888-4888-8888-888888888888",
      revokedAt: new Date("2026-10-02"),
    });
    db.select.mockReturnValueOnce(chain([pending, expired, revoked]));

    const listed = await service.listPendingInvites(
      householdRow.id,
      "admin",
      new Date("2026-10-17")
    );
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(pending.id);

    db.select.mockReturnValueOnce(chain([pending]));
    db.update.mockReturnValueOnce(chain([{ ...pending, revokedAt: new Date("2026-10-17") }]));
    const after = await service.revokeInvite(pending.id, householdRow.id, "owner");
    expect(after.revokedAt).toBeTruthy();
  });

  it("previews an invite and accepts it for a new member", async () => {
    const pending = inviteRow();
    db.select.mockReturnValueOnce(chain([pending])).mockReturnValueOnce(chain([householdRow]));

    const preview = await service.previewInvite(pending.token, new Date("2026-10-17"));
    expect(preview).toMatchObject({
      householdName: "Parent A Kitchen",
      role: "member",
      status: "pending",
    });

    const membershipRow = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-10-17"),
      updatedAt: new Date("2026-10-17"),
      deletedAt: null,
      userId: "99999999-9999-4999-8999-999999999999",
      householdId: householdRow.id,
      role: "member",
    };
    db.select
      .mockReturnValueOnce(chain([pending]))
      .mockReturnValueOnce(chain([householdRow]))
      .mockReturnValueOnce(chain([]));
    db.insert.mockReturnValueOnce(chain([membershipRow]));
    db.update.mockReturnValueOnce(chain([{ ...pending, deletedAt: new Date("2026-10-17") }]));

    const accepted = await service.acceptInvite(
      pending.token,
      "99999999-9999-4999-8999-999999999999",
      new Date("2026-10-17")
    );
    expect(accepted.alreadyMember).toBe(false);
    expect(accepted.membership.role).toBe("member");
    expect(accepted.householdId).toBe(householdRow.id);
    expect(db.update).toHaveBeenCalled();
  });

  it("is idempotent when the user is already in the kitchen", async () => {
    const pending = inviteRow();
    const membershipRow = {
      id: "33333333-3333-4333-8333-333333333333",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      deletedAt: null,
      userId: "99999999-9999-4999-8999-999999999999",
      householdId: householdRow.id,
      role: "member",
    };
    db.select
      .mockReturnValueOnce(chain([pending]))
      .mockReturnValueOnce(chain([householdRow]))
      .mockReturnValueOnce(chain([membershipRow]));
    db.update.mockReturnValueOnce(chain([{ ...pending, deletedAt: new Date("2026-10-17") }]));

    const accepted = await service.acceptInvite(
      pending.token,
      "99999999-9999-4999-8999-999999999999",
      new Date("2026-10-17")
    );
    expect(accepted.alreadyMember).toBe(true);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("rejects expired and revoked links", async () => {
    db.select.mockReturnValueOnce(chain([inviteRow({ expiresAt: new Date("2026-01-01") })]));
    await expect(
      service.acceptInvite(
        "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "99999999-9999-4999-8999-999999999999",
        new Date("2026-10-17")
      )
    ).rejects.toThrow(/expired/);

    db.select.mockReturnValueOnce(chain([inviteRow({ revokedAt: new Date("2026-10-02") })]));
    await expect(
      service.acceptInvite(
        "olinv_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "99999999-9999-4999-8999-999999999999",
        new Date("2026-10-17")
      )
    ).rejects.toThrow(/revoked/);
  });
});
