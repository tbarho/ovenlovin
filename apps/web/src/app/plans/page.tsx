import { redirect } from "next/navigation";
import { AllergenDisclaimer } from "@/components/kitchen/AllergenDisclaimer";
import { MealPlanWeek } from "@/components/kitchen/MealPlanWeek";
import { PlanWeekControls } from "@/components/kitchen/PlanWeekControls";
import { RecheckBanner } from "@/components/kitchen/RecheckBanner";
import { getSessionContext } from "@/lib/session";
import { loadWeekKitchen } from "@/lib/week-plan";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const { week } = await searchParams;
  const kitchen = await loadWeekKitchen(context.householdId, week);
  const status = kitchen.plan?.status ?? "empty";
  const statusLabel =
    status === "empty"
      ? "No plan"
      : status === "approved"
        ? "Final"
        : status === "draft"
          ? "Draft"
          : status;

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            {statusLabel}
          </p>
          <h1>This week</h1>
          <p className="muted">
            {kitchen.weekLabel}. Cook-for changes how many portions to shop and plate. Day cards
            still show each recipe&apos;s stored yield.
          </p>
        </div>
        <PlanWeekControls
          weekStart={kitchen.weekStart}
          planId={kitchen.plan?.id ?? null}
          status={status}
        />
      </div>
      <AllergenDisclaimer />
      {kitchen.plan?.needsRecheck ? <RecheckBanner planId={kitchen.plan.id} /> : null}
      <MealPlanWeek
        days={kitchen.days}
        planId={kitchen.plan?.id ?? null}
        weekStart={kitchen.weekStart}
        entries={kitchen.entries}
        recipes={kitchen.recipes}
        defaultServings={kitchen.defaultServings}
      />
    </>
  );
}
