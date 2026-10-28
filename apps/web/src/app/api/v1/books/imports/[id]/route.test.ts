import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildContentsMap } from "@ovenlovin/core/jobs";
import { OFFSET_BOOK } from "@/test/book-fixtures";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const map = buildContentsMap(OFFSET_BOOK.map((lines, index) => ({ page: index + 1, lines })));

const queue = {
  get: vi.fn(),
  items: vi.fn(),
  patchInput: vi.fn(),
};

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs")>();
  return { ...actual, jobQueue: () => queue };
});
vi.mock("@/lib/api/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/middleware")>();
  return {
    ...actual,
    getRequestContext: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      householdId: HOUSEHOLD,
      membershipRole: "owner" as const,
    }),
  };
});

import { GET, PATCH } from "./route";

const params = (id = JOB) => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: object) =>
  new NextRequest(`http://localhost/api/v1/books/imports/${JOB}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

const job = (input: object = {}) => ({
  id: JOB,
  householdId: HOUSEHOLD,
  kind: "book_import",
  status: "done",
  input: { name: "Book.pdf", pages: 6, ...input },
});

describe("/books/imports/{id}", () => {
  beforeEach(() => {
    vi.stubEnv("OVENLOVIN_BOOKS", "1");
    queue.get.mockResolvedValue(job());
    queue.items.mockResolvedValue([
      { payload: { step: "verify" }, status: "done" },
      { payload: { step: "contents" }, status: "done", result: map },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("is not found while the books flag is off", async () => {
    vi.stubEnv("OVENLOVIN_BOOKS", "");
    expect((await GET(request("GET"), params())).status).toBe(404);
  });

  it("returns the map with every recipe picked by default", async () => {
    const body = await (await GET(request("GET"), params())).json();
    expect(body.status).toBe("ready");
    expect(body.map.candidates).toHaveLength(3);
    expect(body.picks).toEqual(["1-lemon-bars", "2-shortbread", "3-ginger-snaps"]);
  });

  it("hides another household's book", async () => {
    queue.get.mockResolvedValue({ ...job(), householdId: "44444444-4444-4444-8444-444444444444" });
    expect((await GET(request("GET"), params())).status).toBe(404);
    expect((await GET(request("GET"), params("not-a-uuid"))).status).toBe(404);
  });

  it("reports reading and failed states", async () => {
    queue.items.mockResolvedValue([{ payload: { step: "verify" }, status: "running" }]);
    expect((await (await GET(request("GET"), params())).json()).status).toBe("reading");
    queue.items.mockResolvedValue([
      { payload: { step: "verify" }, status: "failed", error: "This PDF is password-protected." },
    ]);
    const failed = await (await GET(request("GET"), params())).json();
    expect(failed).toMatchObject({ status: "failed", error: "This PDF is password-protected." });
  });

  it("saves picks, dropping ids not on the map", async () => {
    const response = await PATCH(
      request("PATCH", { picks: ["2-shortbread", "made-up"] }),
      params()
    );
    expect(response.status).toBe(200);
    expect(queue.patchInput).toHaveBeenCalledWith(JOB, { picks: ["2-shortbread"] });
    expect((await response.json()).picks).toEqual(["2-shortbread"]);
  });

  it("returns saved picks", async () => {
    queue.get.mockResolvedValue(job({ picks: ["3-ginger-snaps"] }));
    expect((await (await GET(request("GET"), params())).json()).picks).toEqual(["3-ginger-snaps"]);
  });

  it("refuses picks before the contents are read", async () => {
    queue.items.mockResolvedValue([]);
    expect((await PATCH(request("PATCH", { picks: [] }), params())).status).toBe(400);
    expect(queue.patchInput).not.toHaveBeenCalled();
  });
});
