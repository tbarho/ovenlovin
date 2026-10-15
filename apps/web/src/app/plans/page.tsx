import Link from "next/link";
import { redirect } from "next/navigation";
import { AllergenDisclaimer } from "@/components/kitchen/AllergenDisclaimer";
import { MealPlanWeek } from "@/components/kitchen/MealPlanWeek";
import { PlanStatusActions } from "@/components/kitchen/PlanStatusActions";
import { RecheckBanner } from "@/components/kitchen/RecheckBanner";
import { WeekPager } from "@/components/kitchen/WeekPager";
import { getSessionContext } from "@/lib/session";
import { loadWeekKitchen } from "@/lib/week-plan";
import { startOfWeekMonday } from "@/lib/week-plan-view";

function statusLabel(status: string): string {
  if (status === "empty") return "No plan";
  if (status === "approved") return "Final";
  if (status === "draft") return "Draft";
  return status;
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const { week } = await searchParams;
  const weekStart = startOfWeekMonday(week);
  const kitchen = await loadWeekKitchen(context.householdId, weekStart);
  const status = kitchen.plan?.status ?? "empty";
  const thisWeek = kitchen.weekStart === startOfWeekMonday();
  const nights = kitchen.days
    .filter((day) => day.meals.some((meal) => !meal.isNoCook))
    .map((day) => day.weekday);

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            {statusLabel(status)}
          </p>
          <h1>{thisWeek ? "This week" : kitchen.weekLabel}</h1>
          <p className="muted">{kitchen.weekLabel}. Dinners the household is cooking.</p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          {kitchen.plan ? (
            <PlanStatusActions planId={kitchen.plan.id} status={kitchen.plan.status} />
          ) : null}
          <Link className="btn" href="/list">
            Shopping list
          </Link>
        </div>
      </div>
      <WeekPager weekStart={kitchen.weekStart} />
      <AllergenDisclaimer />
      {kitchen.plan?.needsRecheck ? (
        <RecheckBanner planId={kitchen.plan.id} nights={nights} />
      ) : null}
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
