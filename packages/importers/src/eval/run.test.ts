import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { PASTE_CASES, PHOTO_CASES } from "./cases";
import { formatSummaryTable, runImportCase, summarizeResults, type CaseResult } from "./run";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/gateway", () => ({ gateway: (id: string) => id }));

function result(partial: Partial<CaseResult>): CaseResult {
  return {
    job: "paste",
    id: "x",
    model: "deepseek/deepseek-v4.1-flash",
    scores: {
      title: 1,
      servings: 1,
      ingredientRecall: 1,
      ingredientPrecision: 1,
      stepCompleteness: 1,
      score: 1,
    },
    latencyMs: 100,
    costUsd: null,
    ...partial,
  };
}

describe("summarizeResults", () => {
  it("averages scores and leaves cost n/a when the gateway omits it", () => {
    const rows = summarizeResults([
      result({ latencyMs: 80, scores: { ...result({}).scores, score: 0.8 } }),
      result({ id: "y", latencyMs: 120, scores: { ...result({}).scores, score: 1 } }),
    ]);
    expect(rows[0]).toMatchObject({
      job: "paste",
      model: "deepseek/deepseek-v4.1-flash",
      score: 0.9,
      p50LatencyMs: 100,
      costPerImportUsd: null,
      cases: 2,
    });
    expect(formatSummaryTable(rows)).toContain(
      "| paste | deepseek/deepseek-v4.1-flash | 0.900 | 100 ms | n/a |"
    );
  });
});

describe("runImportCase", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
  });

  it("rethrows a model schema error instead of scoring zero", async () => {
    vi.mocked(generateObject).mockRejectedValue(
      Object.assign(new Error("No object generated: response did not match schema"), {
        name: "AI_NoObjectGeneratedError",
      })
    );
    const paste = PASTE_CASES[0];
    await expect(runImportCase("deepseek/deepseek-v4.1-flash", paste!)).rejects.toThrow(
      /No object generated/
    );
  });

  it("sends production providerOptions including the DeepSeek pin", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        title: "Classic Chocolate Chip Cookies",
        servings: 24,
        ingredients: [{ text: "flour" }, { text: "butter" }],
        steps: [{ text: "Bake." }],
      },
      providerMetadata: {
        gateway: {
          routing: { provider: "deepseek" },
          warnings: ["unsupported-setting responseFormat"],
        },
      },
    });
    const result = await runImportCase("deepseek/deepseek-v4.1-flash", PASTE_CASES[0]!);
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          gateway: { only: ["deepseek"] },
        },
      })
    );
    expect(result.gateway).toEqual({
      routing: { provider: "deepseek" },
      warnings: ["unsupported-setting responseFormat"],
    });
  });

  it("loads photo eval fixtures as JPEG", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        title: "Weeknight Tomato Pasta",
        servings: 4,
        ingredients: [{ text: "pasta" }, { text: "tomatoes" }],
        steps: [{ text: "Boil." }],
      },
    });
    const photo = PHOTO_CASES.find((item) => item.id === "printed-tomato-pasta");
    await runImportCase("deepseek/deepseek-v4.1-flash", photo!);
    const call = vi.mocked(generateObject).mock.calls[0]?.[0] as {
      messages?: Array<{ content?: Array<{ image?: string }> }>;
    };
    const image = call.messages?.[0]?.content?.find((part) => part.image)?.image ?? "";
    expect(image.startsWith("data:image/jpeg;base64,")).toBe(true);
  });
});
