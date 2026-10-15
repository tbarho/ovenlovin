"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/browser-api";
import { dinnerEntryForDate, filterPlanRecipes, saferPicks } from "@/lib/plan-recipes";
import { KitchenToast } from "./KitchenToast";
import {
  NO_COOK_LABEL,
  slotLabel,
  type PlanEntryDraft,
  type PlanRecipePick,
  type WeekDay,
  type WeekMeal,
} from "@/lib/week-plan-view";

type MealPlanWrite = { id: string };

function mealThumb(title: string, image: string | null) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" />;
  }
  return (
    <div className="week-meal-fallback" aria-hidden="true">
      {title.slice(0, 1)}
    </div>
  );
}

function MealCopy({ meal }: { meal: WeekMeal }) {
  return (
    <div className="week-meal-copy">
      <p className="week-slot">{meal.isNoCook ? "Night off" : slotLabel(meal.mealSlot)}</p>
      <h3>{meal.title}</h3>
      {meal.servings && !meal.isNoCook ? <p className="muted">{meal.servings} servings</p> : null}
      {meal.checkStatus === "incomplete" ? (
        <p className="week-finding" data-severity="warn">
          This check is incomplete — not a clean bill.
        </p>
      ) : null}
      {meal.findings.map((finding) => (
        <p
          className="week-finding"
          data-severity={finding.severity}
          key={`${meal.entryId}-${finding.personName}-${finding.message}`}
        >
          {finding.message}
        </p>
      ))}
    </div>
  );
}

function DayEditor({
  open,
  day,
  current,
  recipes,
  query,
  pending,
  error,
  onQueryChange,
  onPick,
  onClear,
  onNoCook,
}: {
  open: boolean;
  day: WeekDay;
  current: WeekMeal | undefined;
  recipes: PlanRecipePick[];
  query: string;
  pending: boolean;
  error: string | null;
  onQueryChange: (value: string) => void;
  onPick: (recipeId: string) => void;
  onClear: () => void;
  onNoCook: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const blocked = current?.findings.some((finding) => finding.severity === "block") ?? false;
  const swaps = useMemo(
    () => saferPicks(recipes, current?.recipeId ?? null, current?.findings ?? []),
    [recipes, current]
  );
  const listed = useMemo(() => {
    const filtered = filterPlanRecipes(recipes, query);
    if (query.trim()) return filtered;
    const swapIds = new Set(swaps.slice(0, 3).map((recipe) => recipe.id));
    return filtered.filter((recipe) => !swapIds.has(recipe.id));
  }, [query, recipes, swaps]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    rootRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, day.date]);

  if (!open) return null;

  return (
    <div
      className="week-editor"
      id={`plan-editor-${day.date}`}
      data-testid={`plan-editor-${day.date}`}
      ref={rootRef}
    >
      <div className="week-editor-head">
        <div>
          <p className="week-slot">{day.weekday} dinner</p>
          <p className="muted">
            {current
              ? current.isNoCook
                ? "Marked as no-cook. Pick a recipe if plans change."
                : `Now: ${current.title}`
              : "Nothing planned. Pick a dinner, or take the night off."}
          </p>
        </div>
        <div className="week-editor-actions">
          {current ? (
            <button type="button" className="btn compact" disabled={pending} onClick={onClear}>
              Clear night
            </button>
          ) : null}
          <button
            type="button"
            className="btn compact"
            disabled={pending || current?.isNoCook}
            onClick={onNoCook}
          >
            No-cook night
          </button>
        </div>
      </div>

      {blocked && swaps.length > 0 ? (
        <div className="week-swaps">
          <p className="section-label">Safer picks</p>
          <ul className="week-pick-list">
            {swaps.slice(0, 3).map((recipe) => (
              <li key={`swap-${recipe.id}`}>
                <button
                  type="button"
                  className="week-pick"
                  data-safety={recipe.safety}
                  disabled={pending}
                  onClick={() => onPick(recipe.id)}
                >
                  {mealThumb(recipe.title, recipe.image)}
                  <span>
                    <strong>{recipe.title}</strong>
                    <em>Works for everyone on the plan</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <label className="field">
        <span className="field-label">Search recipes</span>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Pasta, tacos, soup…"
        />
      </label>

      {listed.length === 0 ? (
        <p className="muted">No recipes match that search.</p>
      ) : (
        <ul className="week-pick-list">
          {listed.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="week-pick"
                data-safety={recipe.safety}
                data-current={recipe.id === current?.recipeId ? "true" : "false"}
                disabled={pending}
                onClick={() => onPick(recipe.id)}
              >
                {mealThumb(recipe.title, recipe.image)}
                <span>
                  <strong>{recipe.title}</strong>
                  {recipe.id === current?.recipeId ? <em>On the plan</em> : null}
                  {recipe.warning ? (
                    <em className="week-finding" data-severity={recipe.safety}>
                      {recipe.warning}
                    </em>
                  ) : recipe.safety === "ok" ? (
                    <em>Looks clear for everyone</em>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="muted">{error}</p> : null}
    </div>
  );
}

export function MealPlanWeek({
  days,
  planId = null,
  weekStart,
  entries = [],
  recipes = [],
  defaultServings = 4,
}: {
  days: WeekDay[];
  planId?: string | null;
  weekStart?: string;
  entries?: PlanEntryDraft[];
  recipes?: PlanRecipePick[];
  defaultServings?: number;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState(defaultServings);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undoEntries: PlanEntryDraft[] } | null>(
    null
  );
  const resolvedWeekStart = weekStart ?? days[0]?.date ?? "";

  const selectedDay = days.find((day) => day.date === selectedDate);
  const dismissToast = useCallback(() => setToast(null), []);

  async function persist(nextEntries: PlanEntryDraft[]): Promise<boolean> {
    setPending(true);
    setError(null);
    const payload = {
      entries: nextEntries.map((entry) => ({
        date: entry.date,
        meal: entry.mealSlot,
        ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
        ...(entry.freeformMeal ? { freeformMeal: entry.freeformMeal } : {}),
        ...(entry.servings ? { servings: entry.servings } : {}),
        attendees: entry.attendees,
      })),
    };
    try {
      if (!planId) {
        await api<MealPlanWrite>("/api/v1/meal-plans", {
          method: "POST",
          body: JSON.stringify({ weekStart: resolvedWeekStart, status: "draft", ...payload }),
        });
      } else {
        await api(`/api/v1/meal-plans/${planId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the plan");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function withDinner(
    date: string,
    next: { recipeId?: string | null; freeformMeal?: string | null; servings?: number | null }
  ) {
    const previous = entries;
    const rest = entries.filter((entry) => !(entry.date === date && entry.mealSlot === "dinner"));
    const cleared = next.recipeId === null && next.freeformMeal === null;
    const nextEntries = cleared
      ? rest
      : [
          ...rest,
          {
            id: dinnerEntryForDate(entries, date)?.id,
            date,
            mealSlot: "dinner",
            recipeId: next.recipeId ?? null,
            freeformMeal: next.freeformMeal ?? null,
            servings: next.servings ?? dinnerEntryForDate(entries, date)?.servings ?? servings,
            attendees: dinnerEntryForDate(entries, date)?.attendees ?? [],
          },
        ];
    const ok = await persist(nextEntries);
    if (ok && cleared && previous.length > 0) {
      const weekday = days.find((day) => day.date === date)?.weekday ?? "that night";
      setToast({ message: `Cleared ${weekday} dinner`, undoEntries: previous });
    }
  }

  function applyServings(nextServings: number) {
    setServings(nextServings);
    if (entries.length === 0) return;
    void persist(
      entries.map((entry) => (entry.recipeId ? { ...entry, servings: nextServings } : entry))
    );
  }

  return (
    <div className="week-plan" data-testid="meal-plan-week">
      <div className="week-toolbar">
        <label className="week-servings">
          <span>This week we cook for</span>
          <select
            value={servings}
            disabled={pending}
            onChange={(event) => applyServings(Number(event.target.value))}
          >
            {Array.from({ length: 12 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">Tap a day to pick, swap, or clear dinner.</p>
      </div>

      <div className="week-grid">
        {days.map((day) => {
          const meal = day.meals[0];
          const selected = selectedDate === day.date;
          return (
            <section
              className={`week-day${selected ? " is-selected" : ""}`}
              key={day.date}
              aria-labelledby={`day-${day.date}`}
            >
              <button
                type="button"
                className="week-day-hit"
                aria-expanded={selected}
                aria-controls={selected ? `plan-editor-${day.date}` : undefined}
                onClick={() => {
                  setSelectedDate((current) => (current === day.date ? null : day.date));
                  setQuery("");
                  setError(null);
                }}
              >
                <header className="week-day-head">
                  <h2 id={`day-${day.date}`}>{day.weekday}</h2>
                  <p className="muted">{day.label}</p>
                </header>
                {meal ? (
                  <div className="week-meal-link">
                    {mealThumb(meal.title, meal.image)}
                    <MealCopy meal={meal} />
                  </div>
                ) : (
                  <p className="week-empty muted">Add dinner</p>
                )}
              </button>
              {meal?.href ? (
                <Link className="week-meal-open" href={meal.href}>
                  View recipe
                </Link>
              ) : null}
            </section>
          );
        })}
      </div>

      {selectedDay ? (
        <DayEditor
          open
          day={selectedDay}
          current={selectedDay.meals[0]}
          recipes={recipes}
          query={query}
          pending={pending}
          error={error}
          onQueryChange={setQuery}
          onPick={(recipeId) => void withDinner(selectedDay.date, { recipeId, freeformMeal: null })}
          onClear={() => void withDinner(selectedDay.date, { recipeId: null, freeformMeal: null })}
          onNoCook={() =>
            void withDinner(selectedDay.date, { recipeId: null, freeformMeal: NO_COOK_LABEL })
          }
        />
      ) : null}
      <KitchenToast
        message={toast?.message ?? null}
        onUndo={
          toast
            ? () => {
                const restore = toast.undoEntries;
                setToast(null);
                void persist(restore);
              }
            : undefined
        }
        onDismiss={dismissToast}
      />
    </div>
  );
}
