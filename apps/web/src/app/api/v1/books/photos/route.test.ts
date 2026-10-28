import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const HOUSEHOLD = "22222222-2222-4222-8222-222222222222";

const queue = { usage: vi.fn(), enqueue: vi.fn() };
const mapPhotoContents = vi.fn();

vi.mock("@ovenlovin/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/jobs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs")>();
  return { ...actual, jobQueue: () => queue };
});
vi.mock("@/lib/book-shot-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/book-shot-view")>();
  return { ...actual, mapPhotoContents: (images: string[]) => mapPhotoContents(images) };
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

import { POST } from "./route";

const request = () =>
  new NextRequest("http://localhost/api/v1/books/photos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Grandma's book", images: ["data:image/jpeg;base64,AAAA"] }),
  });

describe("POST /books/photos", () => {
  beforeEach(() => {
    vi.stubEnv("OVENLOVIN_BOOKS", "1");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("refuses over the concurrency cap before reading any photo", async () => {
    queue.usage.mockResolvedValue({ activeJobs: 99, jobsThisMonth: 0 });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(queue.usage).toHaveBeenCalledWith(HOUSEHOLD, "book_import");
    expect(mapPhotoContents).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("refuses over the monthly cap before reading any photo", async () => {
    queue.usage.mockResolvedValue({ activeJobs: 0, jobsThisMonth: 9999 });
    expect((await POST(request())).status).toBe(400);
    expect(mapPhotoContents).not.toHaveBeenCalled();
  });
});
