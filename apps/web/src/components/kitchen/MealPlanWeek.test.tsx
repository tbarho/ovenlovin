import { attendingPeopleForEntry } from "@ovenlovin/allergens";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/browser-api";
import { checkMeal } from "@/lib/week-plan";
import { groupMealsByDate, type PlanRecipePick, type WeekMeal } from "@/lib/week-plan-view";
import { testPerson, testPersonRule } from "@/test/fixtures";
import { MealPlanWeek } from "./MealPlanWeek";

const pesto: WeekMeal = {
  entryId: "entry-1",
  date: "2026-10-12",
  mealSlot: "dinner",
  recipeId: "recipe-pesto",
  title: "Weeknight pesto pasta",
  href: "/recipes/pesto",
  image: "/e2e-kitchen/pesto-pasta.svg",
  servings: 4,
  isNoCook: false,
  findings: [
    {
      personName: "Child B",
      severity: "block",
      message: "Contains pine nuts, so Child B can't eat this",
    },
  ],
  checkStatus: "complete",
};

const recipes: PlanRecipePick[] = [
  {
    id: "recipe-pesto",
    title: "Weeknight pesto pasta",
    image: "/e2e-kitchen/pesto-pasta.svg",
    servings: 4,
    cookTimeMinutes: 15,
    prepTimeMinutes: 10,
    safety: "block",
    warning: "Contains pine nuts, so Child B can't eat this",
  },
  {
    id: "recipe-tacos",
    title: "Veggie tacos",
    image: null,
    servings: 4,
    cookTimeMinutes: 20,
    prepTimeMinutes: 10,
    safety: "ok",
    warning: null,
  },
  {
    id: "recipe-kung-pao",
    title: "Kung pao chicken",
    image: null,
    servings: 4,
    cookTimeMinutes: 25,
    prepTimeMinutes: 15,
    safety: "block",
    warning: "Contains peanuts, so Child B can't eat this. Anaphylaxis risk",
  },
  {
    id: "recipe-ziti",
    title: "Baked ziti",
    image: null,
    servings: 6,
    cookTimeMinutes: 40,
    prepTimeMinutes: 15,
    safety: "warn",
    warning: "Contains dairy, so check with Parent B first",
  },
];

describe("MealPlanWeek", () => {
  beforeEach(() => {
    vi.mocked(api).mockReset();
    vi.mocked(api).mockResolvedValue({ id: "plan-1" });
  });

  it("shows the week grid, pesto, and Child B's named block", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [pesto])} />);

    expect(screen.getByTestId("meal-plan-week")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monday" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(screen.getByText("Contains pine nuts, so Child B can't eat this")).toBeInTheDocument();
    expect(screen.queryByText(/block\s*:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view weeknight pesto pasta/i })).toHaveAttribute(
      "href",
      "/recipes/pesto"
    );
    expect(screen.getAllByText("Add dinner")).toHaveLength(6);
    expect(screen.queryByText(/couldn't finish checking this dinner/i)).not.toBeInTheDocument();
  });

  it("does not treat a finished household check as an unfinished dinner", () => {
    const parentA = testPerson({ displayName: "Parent A" });
    const childB = testPerson({
      id: "00000000-0000-4000-8000-000000000012",
      displayName: "Child B",
    });
    const attendees = attendingPeopleForEntry([parentA, childB], []);
    const checked = checkMeal(
      attendees,
      [testPersonRule({ personId: childB.id, target: "peanut", severity: "block" })],
      [{ id: "ing-pasta", name: "pasta" }]
    );
    expect(attendees).toEqual([parentA, childB]);
    expect(checked.checkStatus).toBe("complete");
    const monday: WeekMeal = { ...pesto, ...checked };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [monday])} />);
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(screen.queryByText(/couldn't finish checking this dinner/i)).not.toBeInTheDocument();
  });

  it("names an unfinished dinner check instead of calling it all-clear", () => {
    const attendees = attendingPeopleForEntry([], []);
    const unfinished = checkMeal(attendees, [], [{ id: "ing-pesto", name: "basil pesto" }]);
    expect(attendees).toEqual([]);
    expect(unfinished).toEqual({ findings: [], checkStatus: "incomplete" });
    const monday: WeekMeal = { ...pesto, ...unfinished };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [monday])} />);
    expect(screen.getByText(/couldn't finish checking this dinner/i)).toBeVisible();
  });

  it("shows every meal on a day so a hidden dinner cannot vanish from the plan", () => {
    const pancakes: WeekMeal = {
      ...pesto,
      entryId: "entry-breakfast",
      date: "2026-10-17",
      mealSlot: "breakfast",
      recipeId: "recipe-pancakes",
      title: "Saturday pancakes",
      href: "/recipes/pancakes",
      findings: [],
    };
    const saturdayPesto: WeekMeal = { ...pesto, entryId: "entry-dinner", date: "2026-10-17" };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [pancakes, saturdayPesto])} />);

    expect(screen.getByRole("heading", { name: "Saturday pancakes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view saturday pancakes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view weeknight pesto pasta/i })).toBeInTheDocument();
  });

  it("still shows an empty week so a night can be filled", () => {
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [])} weekStart="2026-10-12" />);
    expect(screen.getByTestId("meal-plan-week")).toBeInTheDocument();
    expect(screen.getAllByText("Add dinner")).toHaveLength(7);
  });

  it("lets a cook pick a safer dinner for a blocked night", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    const editor = screen.getByTestId("plan-editor-2026-10-12");
    expect(within(editor).getByText("Safer picks")).toBeVisible();
    expect(within(editor).getByText("Contains pine nuts, so Child B can't eat this")).toBeVisible();
    expect(within(editor).getByRole("button", { name: /veggie tacos/i })).toBeVisible();
    expect(within(editor).getByRole("button", { name: /weeknight pesto pasta/i })).toBeVisible();

    await user.click(within(editor).getByRole("button", { name: /veggie tacos/i }));
    expect(screen.getByRole("heading", { name: "Veggie tacos" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Weeknight pesto pasta" })
    ).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            recipeId: "recipe-tacos",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
    expect(screen.getByText("Updated Monday dinner")).toBeVisible();

    vi.mocked(api).mockClear();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            recipeId: "recipe-pesto",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("finishes an in-flight swap before persisting a clear", async () => {
    const user = userEvent.setup();
    let releaseFirst: () => void = () => undefined;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let started = 0;
    vi.mocked(api).mockImplementation(async () => {
      started += 1;
      if (started === 1) await firstHold;
      return { id: "plan-1" };
    });

    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    const editor = screen.getByTestId("plan-editor-2026-10-12");
    await user.click(within(editor).getByRole("button", { name: /veggie tacos/i }));
    await waitFor(() => expect(started).toBe(1));
    await user.click(within(editor).getByRole("button", { name: "Clear night" }));
    expect(started).toBe(1);
    releaseFirst();
    await waitFor(() => expect(started).toBe(2));
    const bodies = vi.mocked(api).mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
    expect(bodies[0]?.entries?.[0]?.recipeId).toBe("recipe-tacos");
    expect(bodies[1]?.entries?.[0]?.clear).toBe(true);
  });

  it("marks a night as no-cook and can clear a planned dinner", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    await user.click(screen.getByRole("button", { name: "No-cook night" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            freeformMeal: "No-cook night",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
    expect(screen.getByText("Marked Monday as no-cook")).toBeVisible();

    vi.mocked(api).mockClear();
    await user.click(screen.getByRole("button", { name: "Clear night" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [{ date: "2026-10-12", meal: "dinner", clear: true }],
      }),
    });
    expect(screen.getByText("Cleared Monday dinner")).toBeVisible();
    expect(screen.getAllByText("Add dinner")).toHaveLength(7);

    vi.mocked(api).mockClear();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "No-cook night" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            freeformMeal: "No-cook night",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("restores the dinner on the plan immediately after Undo", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-1",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: "recipe-pesto",
            freeformMeal: null,
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    await user.click(screen.getByRole("button", { name: "Clear night" }));
    expect(screen.getByText("Cleared Monday dinner")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Weeknight pesto pasta" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "Weeknight pesto pasta" })).toBeInTheDocument();
  });

  it("lets a cook clear a no-cook night and undo it", async () => {
    const user = userEvent.setup();
    const noCook: WeekMeal = {
      ...pesto,
      entryId: "entry-off",
      recipeId: null,
      title: "No-cook night",
      href: null,
      image: null,
      isNoCook: true,
      findings: [],
    };
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [noCook])}
        planId="plan-1"
        weekStart="2026-10-12"
        recipes={recipes}
        entries={[
          {
            id: "entry-off",
            date: "2026-10-12",
            mealSlot: "dinner",
            recipeId: null,
            freeformMeal: "No-cook night",
            servings: 4,
            attendees: [],
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    expect(screen.getByText("Marked as no-cook. Pick a recipe if plans change.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear night" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [{ date: "2026-10-12", meal: "dinner", clear: true }],
      }),
    });
    expect(screen.getByText("Cleared Monday dinner")).toBeVisible();
    expect(screen.getAllByText("Add dinner")).toHaveLength(7);

    vi.mocked(api).mockClear();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("heading", { name: "No-cook night" })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans/plan-1", {
      method: "PATCH",
      body: JSON.stringify({
        entries: [
          {
            date: "2026-10-12",
            meal: "dinner",
            freeformMeal: "No-cook night",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("asks before adding a blocked recipe and names who cannot eat it", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: /sunday/i }));
    const editor = screen.getByTestId("plan-editor-2026-10-18");
    expect(within(editor).getByText("Safer picks")).toBeVisible();
    expect(within(editor).getByRole("button", { name: /veggie tacos/i })).toBeVisible();
    expect(within(editor).getByRole("button", { name: /baked ziti/i })).toBeVisible();
    expect(within(editor).getByText(/check with Parent B first/i)).toBeVisible();
    expect(
      within(editor).queryByRole("button", { name: /kung pao chicken/i })
    ).not.toBeInTheDocument();

    await user.click(within(editor).getByRole("button", { name: /not safe for everyone/i }));
    await user.click(within(editor).getByRole("button", { name: /kung pao chicken/i }));
    expect(api).not.toHaveBeenCalled();
    const confirm = screen.getByRole("dialog", { name: /add kung pao chicken to sunday/i });
    expect(confirm).toBeVisible();
    expect(within(confirm).getByText(/child b/i)).toBeVisible();
    expect(within(confirm).getByText(/peanuts/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api).not.toHaveBeenCalled();

    await user.click(within(editor).getByRole("button", { name: /kung pao chicken/i }));
    await user.click(screen.getByRole("button", { name: "Add anyway" }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-10-12",
        status: "draft",
        entries: [
          {
            date: "2026-10-18",
            meal: "dinner",
            recipeId: "recipe-kung-pao",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("opens the editor under the selected day and Close collapses it", async () => {
    const user = userEvent.setup();
    const wednesday: WeekMeal = { ...pesto, date: "2026-10-14", entryId: "entry-wed" };
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [wednesday])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: "Edit Wednesday dinner" }));
    const editor = screen.getByTestId("plan-editor-2026-10-14");
    const wednesdayHeading = screen.getByRole("heading", { name: "Wednesday" });
    const thursdayHeading = screen.getByRole("heading", { name: "Thursday" });
    expect(
      wednesdayHeading.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(editor.compareDocumentPosition(thursdayHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText("Editing Wednesday")).toBeVisible();
    expect(screen.queryByTestId("plan-editor-2026-10-12")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByTestId("plan-editor-2026-10-14")).not.toBeInTheDocument();
  });

  it("keeps only one day editor open and names each day button", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [pesto])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    expect(screen.getByRole("button", { name: "Edit Monday dinner" })).toBeInTheDocument();
    expect(screen.getByText("Select a day to pick, swap, or clear dinner.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit Monday dinner" }));
    expect(screen.getByTestId("plan-editor-2026-10-12")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Tuesday dinner" }));
    expect(screen.queryByTestId("plan-editor-2026-10-12")).not.toBeInTheDocument();
    expect(screen.getByTestId("plan-editor-2026-10-13")).toBeInTheDocument();
  });

  it("explains recipe yield when it differs from the cook-for count", () => {
    const six: WeekMeal = { ...pesto, servings: 6, recipeServings: 6 };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [six])} defaultServings={4} />);
    expect(screen.getByText("6 servings")).toBeVisible();
    expect(screen.getByText("Scale shopping and portions for")).toBeVisible();
  });

  it("lets the plan scale select go to 99 and follows the meals' actual scale", () => {
    const seven: WeekMeal = { ...pesto, servings: 7, recipeServings: 4 };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [seven])} defaultServings={4} />);
    const scale = screen.getByRole("combobox", { name: /scale shopping and portions for/i });
    expect(scale).toHaveValue("7");
    expect(screen.getByRole("option", { name: "99" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "100" })).not.toBeInTheDocument();
  });

  it("uses household Default servings on a chili card when the entry has no servings", () => {
    const chili: WeekMeal = {
      ...pesto,
      title: "Beef chili",
      servings: 6,
      recipeServings: 6,
    };
    render(<MealPlanWeek days={groupMealsByDate("2026-10-12", [chili])} defaultServings={5} />);
    expect(screen.getByText("6 servings")).toBeVisible();
    expect(screen.queryByText("cooking for 5")).not.toBeInTheDocument();
  });

  it("uses recipe yield on a card in recipe mode when the entry has no servings", () => {
    const chili: WeekMeal = {
      ...pesto,
      title: "Beef chili",
      servings: 6,
      recipeServings: 6,
    };
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [chili])}
        defaultServings={4}
        defaultServingsMode="recipe"
      />
    );
    expect(screen.getByText("6 servings")).toBeVisible();
    expect(screen.queryByText("cooking for 4")).not.toBeInTheDocument();
  });

  it("creates a plan when Sunday is still empty", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: /sunday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-10-12",
        status: "draft",
        entries: [
          {
            date: "2026-10-18",
            meal: "dinner",
            recipeId: "recipe-tacos",
            servings: 4,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("stores the cook-for count when adding dinner in family mode", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
        defaultServings={8}
        defaultServingsMode="family"
      />
    );

    await user.click(screen.getByRole("button", { name: /sunday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    expect(api).toHaveBeenCalledWith("/api/v1/meal-plans", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-10-12",
        status: "draft",
        entries: [
          {
            date: "2026-10-18",
            meal: "dinner",
            recipeId: "recipe-tacos",
            servings: 8,
            attendees: [],
          },
        ],
      }),
    });
  });

  it("adds a clear recipe in one tap when nobody has food rules", async () => {
    const user = userEvent.setup();
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={[
          {
            id: "recipe-pizza",
            title: "Weeknight pizza",
            image: null,
            servings: 4,
            cookTimeMinutes: 20,
            prepTimeMinutes: 10,
            safety: "ok",
            warning: null,
          },
        ]}
      />
    );

    await user.click(screen.getByRole("button", { name: /wednesday/i }));
    await user.click(screen.getByRole("button", { name: /weeknight pizza/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add anyway" })).not.toBeInTheDocument();
    expect(screen.queryByText(/no rules provided/i)).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("shows a visible error and retry when adding dinner fails", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockRejectedValueOnce(new Error("Internal Server Error"));
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: /wednesday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not update the plan");
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getAllByText("Add dinner")).toHaveLength(7);

    vi.mocked(api).mockResolvedValue({ id: "plan-1" });
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Veggie tacos" })).toBeInTheDocument();
  });

  it("patches the created plan when adding a second night before refresh", async () => {
    const user = userEvent.setup();
    vi.mocked(api).mockResolvedValue({ id: "plan-new" });
    render(
      <MealPlanWeek
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );

    await user.click(screen.getByRole("button", { name: /monday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledWith(
      "/api/v1/meal-plans",
      expect.objectContaining({ method: "POST" })
    );

    await user.click(screen.getByRole("button", { name: /wednesday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api).toHaveBeenLastCalledWith(
      "/api/v1/meal-plans/plan-new",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("creates a separate plan after changing weeks", async () => {
    const user = userEvent.setup();
    let created = 0;
    vi.mocked(api).mockImplementation(async (_url, init) => {
      if (init && typeof init === "object" && "method" in init && init.method === "POST") {
        created += 1;
        return { id: `plan-${created}` };
      }
      return { id: "patched" };
    });

    const { rerender } = render(
      <MealPlanWeek
        key="2026-10-12"
        days={groupMealsByDate("2026-10-12", [])}
        weekStart="2026-10-12"
        recipes={recipes}
      />
    );
    await user.click(screen.getByRole("button", { name: /sunday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1));

    rerender(
      <MealPlanWeek
        key="2026-10-19"
        days={groupMealsByDate("2026-10-19", [])}
        weekStart="2026-10-19"
        recipes={recipes}
      />
    );
    await user.click(screen.getByRole("button", { name: /sunday/i }));
    await user.click(screen.getByRole("button", { name: /veggie tacos/i }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));

    const posts = vi
      .mocked(api)
      .mock.calls.filter(([, init]) => init && typeof init === "object" && init.method === "POST");
    expect(posts).toHaveLength(2);
    expect(JSON.parse(String(posts[0]?.[1]?.body)).weekStart).toBe("2026-10-12");
    expect(JSON.parse(String(posts[1]?.[1]?.body)).weekStart).toBe("2026-10-19");
  });
});
