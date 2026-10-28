import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookbookShareService, SHARE_BLOCKED_REASON, ShareBlockedError } from "./cookbook-share";

function chain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    innerJoin: vi.fn(() => self),
    limit: vi.fn(async () => result),
    values: vi.fn(() => self),
    set: vi.fn(() => self),
    returning: vi.fn(async () => result),
    then: (resolve: (value: unknown) => void) => resolve(result),
  };
  return self;
}

const COOKBOOK = "33333333-3333-4333-8333-333333333333";
const USER = "11111111-1111-4111-8111-111111111111";
const TOKEN = `olbook_${"a".repeat(43)}`;

describe("CookbookShareService", () => {
  const db = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
  const service = new CookbookShareService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes one public view link for a family cookbook", async () => {
    db.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([]));
    db.insert.mockReturnValueOnce(chain([{ token: TOKEN }]));

    const result = await service.createLink(COOKBOOK, USER);

    expect(result).toEqual({ token: TOKEN, blocked: null });
    const inserted = db.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      resourceType: "collection",
      resourceId: COOKBOOK,
      granteeType: "public",
      permission: "view",
      createdBy: USER,
    });
    expect(inserted.token).toMatch(/^olbook_[A-Za-z0-9_-]{43}$/);
  });

  it("returns the live link instead of minting a second", async () => {
    db.select.mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ token: TOKEN }]));

    expect(await service.createLink(COOKBOOK, USER)).toEqual({ token: TOKEN, blocked: null });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("blocks a cookbook holding published-book recipes, with the reason", async () => {
    db.select.mockReturnValue(chain([{ id: "r1" }]));

    expect(await service.getStatus(COOKBOOK)).toEqual({
      token: null,
      blocked: SHARE_BLOCKED_REASON,
    });
    await expect(service.createLink(COOKBOOK, USER)).rejects.toBeInstanceOf(ShareBlockedError);
    expect(db.insert).not.toHaveBeenCalled();
    db.select.mockReset();
  });

  it("revokes by soft delete", async () => {
    db.update.mockReturnValueOnce(chain([]));
    await service.revokeLink(COOKBOOK);
    const set = db.update.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(set.deletedAt).toBeInstanceOf(Date);
  });

  it("resolves a live link and refuses unknown, revoked, or newly blocked ones", async () => {
    expect(await service.resolveLink("olinv_nope")).toBeNull();
    expect(db.select).not.toHaveBeenCalled();

    db.select.mockReturnValueOnce(chain([]));
    expect(await service.resolveLink(TOKEN)).toBeNull();

    const link = chain([{ cookbookId: COOKBOOK }]);
    db.select.mockReturnValueOnce(link).mockReturnValueOnce(chain([]));
    expect(await service.resolveLink(TOKEN)).toBe(COOKBOOK);

    db.select.mockReturnValueOnce(link).mockReturnValueOnce(chain([{ id: "r1" }]));
    expect(await service.resolveLink(TOKEN)).toBeNull();
  });
});
