import Link from "next/link";
import { ShoppingList } from "@/components/kitchen/ShoppingList";
import { requireKitchenContext } from "@/lib/kitchen-session";
import { loadWeekKitchen } from "@/lib/week-plan";

export default async function ShoppingListPage() {
  const context = await requireKitchenContext();

  const kitchen = await loadWeekKitchen(context.householdId);

  return (
    <>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            {kitchen.weekLabel}
          </p>
          <h1>Shopping list</h1>
          <p className="muted">
            Ingredients for this week, with named warnings for anyone who can&apos;t eat an item.
          </p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <Link className="btn" href="/plans">
            ← Plan
          </Link>
        </div>
      </div>
      <ShoppingList
        items={kitchen.shopping}
        planId={kitchen.plan?.id ?? null}
        checkedKeys={kitchen.shoppingState.checkedKeys}
        extras={kitchen.shoppingState.extras}
        scaledFor={kitchen.defaultServings}
        scaledForMixed={false}
      />
    </>
  );
}
