"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DefaultServingsMode } from "@ovenlovin/core";
import { cookForServingsLabel, SERVINGS_HARD_MAX } from "@ovenlovin/core/scaling";
import { api } from "@/lib/browser-api";
import {
  applyDinnerToDays,
  applyDinnerToEntries,
  dinnerEntryForDate,
  partitionPlanRecipes,
  planRiskConfirmCopy,
  recipeNeedsPlanConfirm,
} from "@/lib/plan-recipes";
import { ConfirmDialog } from "./ConfirmDialog";
import { KitchenToast } from "./KitchenToast";
import {
  NO_COOK_LABEL,
  planRecipeHref,
  slotLabel,
  type PlanEntryDraft,
  type PlanRecipePick,
  type WeekDay,
  type WeekMeal,
} from "@/lib/week-plan-view";

type MealPlanWrite = { id: string };

const EMPTY_ENTRIES: PlanEntryDraft[] = [];
const EMPTY_RECIPES: PlanRecipePick[] = [];

function dinnerMeal(day: WeekDay): WeekMeal | undefined {
  return day.meals.find((meal) => meal.mealSlot === "dinner") ?? day.meals[0];
}

function RecipePickButton({
  recipe,
  currentRecipeId,
  pending,
  onPick,
}: {
  recipe: PlanRecipePick;
  currentRecipeId: string | null;
  pending: boolean;
  onPick: (recipeId: string) => void;
}) {
  return (
    <button
      type="button"
      className="week-pick"
      data-safety={recipe.safety}
      data-current={recipe.id === currentRecipeId ? "true" : "false"}
      disabled={pending}
      onClick={() => onPick(recipe.id)}
    >
      {mealThumb(recipe.title, recipe.image)}
      <span>
        <strong>{recipe.title}</strong>
        {recipe.id === currentRecipeId ? <em>On the plan</em> : null}
        {recipe.warning ? (
          <em className="week-finding" data-severity={recipe.safety}>
            {recipe.warning}
          </em>
        ) : recipe.safety === "ok" ? (
          <em>Looks clear for everyone</em>
        ) : null}
      </span>
    </button>
  );
}

function dinnerWriteError(
  recipes: PlanRecipePick[],
  days: WeekDay[],
  date: string,
  next: { recipeId?: string | null }
): string {
  const day = days.find((item) => item.date === date);
  const weekday = day?.weekday ?? "that night";
  const recipe = next.recipeId ? recipes.find((item) => item.id === next.recipeId) : undefined;
  if (!recipe) return "Could not update the plan";
  const prior = day ? dinnerMeal(day) : undefined;
  return `Couldn't ${prior?.recipeId ? "swap" : "add"} ${recipe.title} to ${weekday}. Nothing was saved.`;
}

function uniqueFindings(findings: WeekMeal["findings"]) {
  const byPerson = new Map<string, WeekMeal["findings"][number]>();
  for (const finding of findings) {
    const key = `${finding.personName}\0${finding.severity}`;
    const existing = byPerson.get(key);
    if (!existing || finding.message.length > existing.message.length) {
      byPerson.set(key, finding);
    }
  }
  return [...byPerson.values()];
}

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

function servingsCopy(meal: WeekMeal, cookFor: number): string | null {
  if (meal.isNoCook) return null;
  return cookForServingsLabel({
    cookFor,
    recipeServings: meal.recipeServings,
  });
}

function MealCopy({ meal, cookFor }: { meal: WeekMeal; cookFor: number }) {
  const servings = servingsCopy(meal, cookFor);
  return (
    <div className="week-meal-copy">
      <p className="week-slot">{meal.isNoCook ? "Night off" : slotLabel(meal.mealSlot)}</p>
      <h3>{meal.title}</h3>
      {servings ? <p className="muted">{servings}</p> : null}
      {meal.checkStatus === "incomplete" && meal.findings.length === 0 ? (
        <p className="week-finding" data-severity="warn">
          We couldn&apos;t finish checking this dinner.
        </p>
      ) : null}
      {uniqueFindings(meal.findings).map((finding) => (
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
  onQueryChange,
  onPick,
  onClear,
  onNoCook,
  onClose,
}: {
  open: boolean;
  day: WeekDay;
  current: WeekMeal | undefined;
  recipes: PlanRecipePick[];
  query: string;
  pending: boolean;
  onQueryChange: (value: string) => void;
  onPick: (recipeId: string) => void;
  onClear: () => void;
  onNoCook: () => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [unsafeOpen, setUnsafeOpen] = useState(false);
  const groups = useMemo(
    () => partitionPlanRecipes(recipes, query, current?.recipeId ?? null),
    [recipes, query, current]
  );

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setUnsafeOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => setExpanded(true));
    return () => cancelAnimationFrame(frame);
  }, [open, day.date]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    rootRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, day.date]);

  if (!open) return null;

  return (
    <div
      className={`week-editor-slot${expanded ? " is-open" : ""}`}
      id={`plan-editor-${day.date}`}
      data-testid={`plan-editor-${day.date}`}
      ref={rootRef}
    >
      <div className="week-editor-clip">
        <div className="week-editor">
          <div className="week-editor-head">
            <div>
              <p className="week-slot">Editing {day.weekday}</p>
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
                <button type="button" className="btn compact hit44-y" onClick={onClear}>
                  Clear night
                </button>
              ) : null}
              <button
                type="button"
                className="btn compact hit44-y"
                disabled={current?.isNoCook}
                onClick={onNoCook}
              >
                No-cook night
              </button>
              <button type="button" className="btn compact hit44-y" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          {groups.safer.length > 0 ? (
            <div className="week-swaps">
              <p className="section-label">Safer picks</p>
              <ul className="week-pick-list">
                {groups.safer.map((recipe) => (
                  <li key={`swap-${recipe.id}`}>
                    <button
                      type="button"
                      className="week-pick"
                      data-safety={recipe.safety}
                      onClick={() => onPick(recipe.id)}
                    >
                      {mealThumb(recipe.title, recipe.image)}
                      <span>
                        <strong>{recipe.title}</strong>
                        <em>Looks clear for everyone</em>
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

          {groups.safe.length === 0 && groups.unsafe.length === 0 ? (
            <p className="muted">No recipes match that search.</p>
          ) : (
            <>
              {groups.safe.length > 0 ? (
                <ul className="week-pick-list">
                  {groups.safe.map((recipe) => (
                    <li key={recipe.id}>
                      <RecipePickButton
                        recipe={recipe}
                        currentRecipeId={current?.recipeId ?? null}
                        pending={false}
                        onPick={onPick}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {groups.unsafe.length > 0 ? (
                <div className="week-unsafe">
                  <button
                    type="button"
                    className="week-unsafe-toggle"
                    aria-expanded={unsafeOpen}
                    onClick={() => setUnsafeOpen((open) => !open)}
                  >
                    Not safe for everyone ({groups.unsafe.length})
                  </button>
                  {unsafeOpen ? (
                    <ul className="week-pick-list">
                      {groups.unsafe.map((recipe) => (
                        <li key={recipe.id}>
                          <RecipePickButton
                            recipe={recipe}
                            currentRecipeId={current?.recipeId ?? null}
                            pending={false}
                            onPick={onPick}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
          {pending ? <p className="muted">Saving this night…</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MealPlanWeek({
  days,
  planId = null,
  weekStart,
  entries = EMPTY_ENTRIES,
  recipes = EMPTY_RECIPES,
  defaultServings = 4,
  defaultServingsMode = "family",
  familySize = 0,
  householdCookFor = defaultServings,
  followsHousehold = true,
}: {
  days: WeekDay[];
  planId?: string | null;
  weekStart?: string;
  entries?: PlanEntryDraft[];
  recipes?: PlanRecipePick[];
  defaultServings?: number;
  defaultServingsMode?: DefaultServingsMode;
  familySize?: number;
  householdCookFor?: number;
  followsHousehold?: boolean;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [servings, setServings] = useState(defaultServings);
  const [followingHousehold, setFollowingHousehold] = useState(followsHousehold);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createdPlanIdRef = useRef<string | null>(null);
  const [failedDinner, setFailedDinner] = useState<{
    date: string;
    next: { recipeId?: string | null; freeformMeal?: string | null; servings?: number | null };
  } | null>(null);
  const [daysView, setDaysView] = useState(days);
  const [entriesView, setEntriesView] = useState(entries);
  const [pendingPick, setPendingPick] = useState<PlanRecipePick | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    undoEntries: PlanEntryDraft[];
    undoDays: WeekDay[];
  } | null>(null);
  const resolvedWeekStart = weekStart ?? days[0]?.date ?? "";

  function currentPlanId() {
    return planId ?? createdPlanIdRef.current;
  }

  useEffect(() => {
    setDaysView(days);
  }, [days]);
  useEffect(() => {
    setEntriesView(entries);
  }, [entries]);

  const selectedDay = daysView.find((day) => day.date === selectedDate);
  const persistQueue = useRef(Promise.resolve());
  const dismissToast = useCallback(() => setToast(null), []);
  const dismissError = useCallback(() => {
    setError(null);
    setFailedDinner(null);
  }, []);
  const closeEditor = useCallback(() => {
    setSelectedDate(null);
    setQuery("");
    setError(null);
    setPendingPick(null);
    setFailedDinner(null);
  }, []);

  function toEntryWrite(entry: PlanEntryDraft) {
    return {
      date: entry.date,
      meal: entry.mealSlot,
      ...(entry.recipeId ? { recipeId: entry.recipeId } : {}),
      ...(entry.freeformMeal ? { freeformMeal: entry.freeformMeal } : {}),
      ...(entry.servings ? { servings: entry.servings } : {}),
      attendees: entry.attendees,
    };
  }

  async function persist(
    nextEntries: PlanEntryDraft[],
    patch?: { entries?: Array<Record<string, unknown>>; cookFor?: number | null }
  ): Promise<boolean> {
    const run = async () => {
      setPending(true);
      setError(null);
      const writes = nextEntries.map(toEntryWrite);
      try {
        const id = currentPlanId();
        if (!id) {
          const created = await api<MealPlanWrite>("/api/v1/meal-plans", {
            method: "POST",
            body: JSON.stringify({
              weekStart: resolvedWeekStart,
              status: "draft",
              ...("cookFor" in (patch ?? {}) ? { cookFor: patch?.cookFor } : {}),
              entries: writes,
            }),
          });
          if (created?.id) createdPlanIdRef.current = created.id;
          router.refresh();
        } else {
          await api(`/api/v1/meal-plans/${id}`, {
            method: "PATCH",
            body: JSON.stringify(patch ?? { entries: writes }),
          });
          if (!patch) router.refresh();
        }
        return true;
      } catch {
        setError("Could not update the plan");
        return false;
      } finally {
        setPending(false);
      }
    };
    const queued = persistQueue.current.then(run, run);
    persistQueue.current = queued.then(
      () => undefined,
      () => undefined
    );
    return queued;
  }

  async function withDinner(
    date: string,
    next: { recipeId?: string | null; freeformMeal?: string | null; servings?: number | null }
  ) {
    const previousDays = daysView;
    const previous = entriesView;
    const cleared = next.recipeId === null && next.freeformMeal === null;
    const nextServings = next.servings ?? dinnerEntryForDate(entriesView, date)?.servings ?? null;
    const nextEntries = applyDinnerToEntries(entriesView, date, {
      ...next,
      servings: nextServings,
    });
    const nextDinner = dinnerEntryForDate(nextEntries, date);
    const nightPatch = cleared
      ? [{ date, meal: "dinner" as const, clear: true }]
      : nextDinner
        ? [toEntryWrite(nextDinner)]
        : [];
    setDaysView(applyDinnerToDays(daysView, date, next, recipes));
    setEntriesView(nextEntries);
    const ok = await persist(nextEntries, currentPlanId() ? { entries: nightPatch } : undefined);
    if (!ok) {
      setDaysView(previousDays);
      setEntriesView(previous);
      setFailedDinner({ date, next });
      setError(dinnerWriteError(recipes, previousDays, date, next));
      return;
    }
    setFailedDinner(null);
    const weekday = daysView.find((day) => day.date === date)?.weekday ?? "that night";
    const message = cleared
      ? `Cleared ${weekday} dinner`
      : next.freeformMeal
        ? `Marked ${weekday} as no-cook`
        : `Updated ${weekday} dinner`;
    setToast({ message, undoEntries: previous, undoDays: previousDays });
  }

  function requestPick(recipeId: string) {
    if (!selectedDay) return;
    const recipe = recipes.find((item) => item.id === recipeId);
    if (recipe && recipeNeedsPlanConfirm(recipe)) {
      setPendingPick(recipe);
      return;
    }
    void withDinner(selectedDay.date, { recipeId, freeformMeal: null });
  }

  function confirmPendingPick() {
    if (!selectedDay || !pendingPick) return;
    const recipeId = pendingPick.id;
    setPendingPick(null);
    void withDinner(selectedDay.date, { recipeId, freeformMeal: null });
  }

  function applyServings(nextServings: number | null) {
    if (nextServings == null) {
      setFollowingHousehold(true);
      setServings(householdCookFor);
      void persist(entriesView, { cookFor: null });
      return;
    }
    setFollowingHousehold(false);
    setServings(nextServings);
    void persist(entriesView, { cookFor: nextServings });
  }

  return (
    <div
      className={`week-plan${pending ? " is-pending" : ""}`}
      data-testid="meal-plan-week"
      aria-busy={pending}
    >
      <div className="week-toolbar">
        <label className="week-servings">
          <span>Scale shopping and portions for</span>
          <select
            value={followingHousehold ? "household" : String(servings)}
            disabled={pending}
            onChange={(event) => {
              const value = event.target.value;
              applyServings(value === "household" ? null : Number(value));
            }}
          >
            <option value="household">Match household ({householdCookFor})</option>
            {Array.from({ length: SERVINGS_HARD_MAX }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        {defaultServingsMode === "family" &&
        familySize > 0 &&
        !followingHousehold &&
        servings !== familySize ? (
          <p className="muted">
            This week is scaled for {servings}. Your household has {familySize} people.
          </p>
        ) : null}
        <p className="muted">Select a day to pick, swap, or clear dinner.</p>
      </div>

      <div className="week-grid">
        {daysView.map((day) => {
          const selected = selectedDate === day.date;
          return (
            <Fragment key={day.date}>
              <section
                className={`week-day${selected ? " is-selected" : ""}`}
                aria-labelledby={`day-${day.date}`}
              >
                <button
                  type="button"
                  className="week-day-hit"
                  aria-expanded={selected}
                  aria-controls={selected ? `plan-editor-${day.date}` : undefined}
                  aria-label={`Edit ${day.weekday} dinner`}
                  onClick={() => {
                    setSelectedDate((current) => (current === day.date ? null : day.date));
                    setQuery("");
                    setError(null);
                    setPendingPick(null);
                    setFailedDinner(null);
                  }}
                >
                  <header className="week-day-head">
                    <h2 id={`day-${day.date}`}>{day.weekday}</h2>
                    <p className="muted">{day.label}</p>
                  </header>
                  {day.meals.length === 0 ? (
                    <p className="week-empty muted">Add dinner</p>
                  ) : (
                    <div className="week-day-meals">
                      {day.meals.map((meal) => (
                        <div className="week-meal-link" key={meal.entryId}>
                          {mealThumb(meal.title, meal.image)}
                          <MealCopy meal={meal} cookFor={servings} />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
                {day.meals
                  .filter((meal) => meal.href)
                  .map((meal) => (
                    <Link
                      className="week-meal-open hit44-y"
                      href={
                        meal.recipeId
                          ? planRecipeHref(meal.recipeId, servings)
                          : (meal.href ?? "/recipes")
                      }
                      key={meal.entryId}
                    >
                      View {meal.title}
                    </Link>
                  ))}
              </section>
              {selected && selectedDay ? (
                <DayEditor
                  open
                  day={selectedDay}
                  current={dinnerMeal(selectedDay)}
                  recipes={recipes}
                  query={query}
                  pending={pending}
                  onQueryChange={setQuery}
                  onPick={requestPick}
                  onClear={() =>
                    void withDinner(selectedDay.date, { recipeId: null, freeformMeal: null })
                  }
                  onNoCook={() =>
                    void withDinner(selectedDay.date, {
                      recipeId: null,
                      freeformMeal: NO_COOK_LABEL,
                    })
                  }
                  onClose={closeEditor}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
      <ConfirmDialog
        open={Boolean(pendingPick && selectedDay)}
        title={
          pendingPick && selectedDay
            ? planRiskConfirmCopy(pendingPick, selectedDay.weekday).title
            : "Add this recipe?"
        }
        body={
          pendingPick && selectedDay
            ? planRiskConfirmCopy(pendingPick, selectedDay.weekday).body
            : ""
        }
        confirmLabel="Add anyway"
        pending={pending}
        danger
        onCancel={() => setPendingPick(null)}
        onConfirm={confirmPendingPick}
      />
      <KitchenToast
        message={error ?? toast?.message ?? null}
        actionLabel={error && failedDinner ? "Try again" : undefined}
        onUndo={
          error
            ? failedDinner
              ? () => void withDinner(failedDinner.date, failedDinner.next)
              : undefined
            : toast && !pending
              ? () => {
                  const restore = toast.undoEntries;
                  const restoreDays = toast.undoDays;
                  setToast(null);
                  setEntriesView(restore);
                  setDaysView(restoreDays);
                  void persist(restore);
                }
              : undefined
        }
        onDismiss={error ? dismissError : dismissToast}
      />
    </div>
  );
}
