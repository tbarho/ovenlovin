import Link from "next/link";
import { redirect } from "next/navigation";
import { AllergenDisclaimer } from "@/components/kitchen/AllergenDisclaimer";
import { MealPlanWeek } from "@/components/kitchen/MealPlanWeek";
import { RecheckBanner } from "@/components/kitchen/RecheckBanner";
import { getSessionContext } from "@/lib/session";
import { loadWeekKitchen } from "@/lib/week-plan";

export default async function PlansPage() {
  const context = await getSessionContext().catch(() => null);
  if (!context?.householdId) redirect("/sign-in");

  const kitchen = await loadWeekKitchen(context.householdId);
  const status = kitchen.plan?.status ?? "empty";

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            {status === "empty" ? "No plan" : status}
          </p>
          <h1>This week</h1>
          <p className="muted">{kitchen.weekLabel}. Dinners the household is cooking.</p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <Link className="btn" href="/list">
            Shopping list
          </Link>
        </div>
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
