import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeopleService } from "./people";

const PERSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RULE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW_RULE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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

const createPayload = {
  personId: PERSON_ID,
  kind: "allergen" as const,
  target: "peanut",
  severity: "block" as const,
  includeMayContain: true,
  includeCrossContact: true,
  sharedFacility: "block" as const,
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
};

function selectChain(result: unknown[]) {
  const promise = Promise.resolve(result);
  const self = {
    from: vi.fn(() => self),
    where: vi.fn(() => self),
    limit: vi.fn(() => self),
    then: promise.then.bind(promise),
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

function updateChain(result: unknown[]) {
  const self = {
    set: vi.fn(() => self),
    where: vi.fn(() => self),
    returning: vi.fn(async () => result),
  };
  return self;
}

describe("PeopleService rule dedupe", () => {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  const service = new PeopleService(db as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing peanut/block rule instead of inserting a duplicate", async () => {
    db.select.mockReturnValueOnce(selectChain([existingRow]));

    const created = await service.createRule(createPayload);

    expect(created.created).toBe(false);
    expect(created.rule.id).toBe(RULE_ID);
    expect(created.rule.target).toBe("peanut");
    expect(created.rule.severity).toBe("block");
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("updates label and note on an existing matching rule", async () => {
    db.select.mockReturnValueOnce(selectChain([existingRow]));
    db.update.mockReturnValueOnce(
      updateChain([{ ...existingRow, label: "School lunch note", note: "Keep epi-pen" }])
    );

    const created = await service.createRule({
      ...createPayload,
      label: "School lunch note",
      note: "Keep epi-pen",
    });

    expect(created.created).toBe(false);
    expect(created.rule.id).toBe(RULE_ID);
    expect(created.rule.label).toBe("School lunch note");
    expect(created.rule.note).toBe("Keep epi-pen");
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalled();
  });

  it("inserts a permanent peanut block when only a timed one exists", async () => {
    db.select.mockReturnValueOnce(selectChain([{ ...existingRow, activeUntil: "2026-11-01" }]));
    db.insert.mockReturnValueOnce(insertChain([{ ...existingRow, id: NEW_RULE_ID }]));

    const created = await service.createRule(createPayload);

    expect(created.created).toBe(true);
    expect(created.rule.id).toBe(NEW_RULE_ID);
    expect(db.insert).toHaveBeenCalled();
  });

  it("dedupes a REST-style block that omits check settings onto MCP block defaults", async () => {
    db.select.mockReturnValueOnce(selectChain([existingRow]));
    const sparse = {
      personId: PERSON_ID,
      kind: "allergen" as const,
      target: "peanut",
      severity: "block" as const,
      setBy: existingRow.setBy,
      createdBy: existingRow.createdBy,
    };

    const created = await service.createRule(sparse as typeof createPayload);

    expect(created.created).toBe(false);
    expect(created.rule.id).toBe(RULE_ID);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("inserts when may-contain differs from the existing peanut block", async () => {
    db.select.mockReturnValueOnce(selectChain([existingRow]));
    db.insert.mockReturnValueOnce(insertChain([{ ...existingRow, id: NEW_RULE_ID }]));

    const created = await service.createRule({
      ...createPayload,
      includeMayContain: false,
    });

    expect(created.created).toBe(true);
    expect(created.rule.id).toBe(NEW_RULE_ID);
    expect(db.insert).toHaveBeenCalled();
  });

  it("inserts when no matching rule exists", async () => {
    db.select.mockReturnValueOnce(selectChain([]));
    db.insert.mockReturnValueOnce(insertChain([{ ...existingRow, id: NEW_RULE_ID }]));

    const created = await service.createRule(createPayload);

    expect(created.created).toBe(true);
    expect(created.rule.id).toBe(NEW_RULE_ID);
    expect(db.insert).toHaveBeenCalled();
  });
});
