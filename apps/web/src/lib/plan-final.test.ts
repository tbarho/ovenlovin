import { describe, expect, it } from "vitest";
import {
  blockNightsFromDays,
  planFinalConfirmCopy,
  recheckBannerDetail,
  recheckNightsFromDays,
} from "./plan-final";

describe("planFinalConfirmCopy", () => {
  it("does not confirm a clear draft", () => {
    expect(planFinalConfirmCopy({ needsRecheck: false, blockNights: [] }).needsConfirm).toBe(false);
  });

  it("confirms when a dinner is anaphylaxis-risk and a recheck is pending", () => {
    const copy = planFinalConfirmCopy({
      needsRecheck: true,
      blockNights: [
        {
          weekday: "Saturday",
          message: "Contains pine nuts, so Child C can't eat this. Anaphylaxis risk.",
        },
      ],
    });
    expect(copy.needsConfirm).toBe(true);
    expect(copy.body).toMatch(/still needs a recheck/i);
    expect(copy.body).toMatch(/Saturday has an anaphylaxis-risk dinner/);
    expect(copy.body).toMatch(/Warnings stay on the plan/);
  });
});

describe("recheckBannerDetail", () => {
  it("names the nights and why a can't-eat dinner is still on the plan", () => {
    expect(
      recheckBannerDetail({
        nights: ["Saturday"],
        blockNights: [
          {
            weekday: "Saturday",
            message: "Contains pine nuts, so Child C can't eat this.",
          },
        ],
      })
    ).toBe("These dinners need a fresh check: Saturday. Saturday still has a can't-eat dinner.");
  });
});

describe("plan night helpers", () => {
  it("lists recipe nights and block nights", () => {
    const days = [
      {
        weekday: "Friday",
        meals: [{ isNoCook: true, recipeId: null, findings: [] }],
      },
      {
        weekday: "Saturday",
        meals: [
          {
            isNoCook: false,
            recipeId: "pesto",
            findings: [
              { severity: "block", message: "Contains pine nuts, so Child C can't eat this." },
            ],
          },
        ],
      },
    ];
    expect(recheckNightsFromDays(days)).toEqual(["Saturday"]);
    expect(blockNightsFromDays(days)).toEqual([
      {
        weekday: "Saturday",
        message: "Contains pine nuts, so Child C can't eat this.",
      },
    ]);
  });
});
