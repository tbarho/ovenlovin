import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeopleService } from "./people";

const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const existingRow = {
  id: RULE_ID,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  deletedAt: null,
  createdBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  personId: PERSON_ID,
  kind: "allergen",
  target: "peanut",
  severity: "block",
  includeMayContain: true,
  includeCrossContact: true,
  sharedFacility: "block",
  includeUnmappedIngredients: false,
  includeDescendants: true,
  treatCoconutAsTreeNut: false,
  label: null,
  note: null,
  activeFrom: null,
  activeUntil: null,
  setBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  createdByApiKeyId: null,
};

function selectChain(result: unknown[]) {
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(async () => result),
    orderBy: vi.fn(async () => result),
  };
  return self;
}

function insertChain(result: unknown[]) {
  const self = {
    values: vi.fn(() => self),
    returning: vi.fn(async () => result),
  };
  return self;
}

describe("PeopleService rule dedupe", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
  };
  const service = new PeopleService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing peanut/block rule instead of inserting a duplicate", async () => {
    db.select.mockReturnValueOnce(selectChain([existingRow]));

    const created = await service.createRule({
      personId: PERSON_ID,
      kind: "allergen",
      target: "peanut",
      severity: "block",
      includeMayContain: true,
      includeCrossContact: true,
      sharedFacility: "block",
      includeUnmappedIngredients: false,
      includeDescendants: true,
      treatCoconutAsTreeNut: false,
      label: null,
      note: null,
      activeFrom: null,
      activeUntil: null,
      setBy: existingRow.setBy,
      createdBy: existingRow.createdBy,
      createdByApiKeyId: null,
    });

    expect(created.id).toBe(RULE_ID);
    expect(created.target).toBe("peanut");
    expect(created.severity).toBe("block");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("inserts when no matching rule exists", async () => {
    db.select.mockReturnValueOnce(selectChain([]));
    db.insert.mockReturnValueOnce(
      insertChain([{ ...existingRow, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }])
    );

    const created = await service.createRule({
      personId: PERSON_ID,
      kind: "allergen",
      target: "peanut",
      severity: "block",
      includeMayContain: true,
      includeCrossContact: true,
      sharedFacility: "block",
      includeUnmappedIngredients: false,
      includeDescendants: true,
      treatCoconutAsTreeNut: false,
      label: null,
      note: null,
      activeFrom: null,
      activeUntil: null,
      setBy: existingRow.setBy,
      createdBy: existingRow.createdBy,
      createdByApiKeyId: null,
    });

    expect(created.id).toBe("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expect(db.insert).toHaveBeenCalled();
  });
});
