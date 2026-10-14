import Link from "next/link";
import { slotLabel, type WeekDay } from "@/lib/week-plan";

export function MealPlanWeek({ days }: { days: WeekDay[] }) {
  const planned = days.some((day) => day.meals.length > 0);

  if (!planned) {
    return (
      <p className="empty-note">
        Nothing planned this week. Ask your agent to draft a plan, or cook from{" "}
        <Link href="/recipes">Recipes</Link>.
      </p>
    );
  }

  return (
    <div className="week-grid" data-testid="meal-plan-week">
      {days.map((day) => (
        <section className="week-day" key={day.date} aria-labelledby={`day-${day.date}`}>
          <header className="week-day-head">
            <h2 id={`day-${day.date}`}>{day.weekday}</h2>
            <p className="muted">{day.label}</p>
          </header>
          {day.meals.length === 0 ? (
            <p className="week-empty muted">Nothing planned</p>
          ) : (
            <ul className="week-meals">
              {day.meals.map((meal) => {
                const body = (
                  <>
                    {meal.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={meal.image} alt="" />
                    ) : (
                      <div className="week-meal-fallback" aria-hidden="true">
                        {meal.title.slice(0, 1)}
                      </div>
                    )}
                    <div className="week-meal-copy">
                      <p className="week-slot">{slotLabel(meal.mealSlot)}</p>
                      <h3>{meal.title}</h3>
                      {meal.servings ? <p className="muted">{meal.servings} servings</p> : null}
                      {meal.checkStatus === "incomplete" ? (
                        <p className="week-finding" data-severity="warn">
                          This check is incomplete — not a clean bill.
                        </p>
                      ) : null}
                      {meal.findings.map((finding) => (
                        <p
                          className="week-finding"
                          data-severity={finding.severity}
                          key={`${meal.entryId}-${finding.personName}`}
                        >
                          {finding.message}
                        </p>
                      ))}
                    </div>
                  </>
                );
                return (
                  <li className="week-meal" key={meal.entryId}>
                    {meal.href ? (
                      <Link className="week-meal-link" href={meal.href}>
                        {body}
                      </Link>
                    ) : (
                      <div className="week-meal-link">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
