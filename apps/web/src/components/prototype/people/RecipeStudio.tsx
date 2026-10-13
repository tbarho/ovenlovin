"use client";

import { useCallback, useMemo, useState } from "react";
import {
  RECIPES,
  checkRecipe,
  cookingForPeople,
  recipeById,
  type CookingFor,
  type Finding,
  type Mark,
} from "./model";
import { usePrototype } from "./store";
import { Avatar, EmptyState, MarkBadge, Segmented, Sheet } from "./ui";

export function RecipeStudio() {
  const {
    household,
    cookingFor,
    setCookingFor,
    appliedSwaps,
    toggleSwap,
    featuredRecipeId,
    setFeaturedRecipe,
  } = usePrototype();
  const [explain, setExplain] = useState<Finding | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const closeExplain = useCallback(() => setExplain(null), []);
  const closeCustom = useCallback(() => setCustomOpen(false), []);
  const [customIds, setCustomIds] = useState<string[]>(
    cookingFor.mode === "custom"
      ? cookingFor.personIds
      : household.people.map((person) => person.id)
  );

  const recipe = recipeById(featuredRecipeId) ?? RECIPES[0];
  const swapIds = useMemo(
    () => (recipe ? (appliedSwaps[recipe.id] ?? []) : []),
    [appliedSwaps, recipe]
  );
  const findings = useMemo(
    () => (recipe ? checkRecipe(household, recipe, swapIds, cookingFor) : []),
    [household, recipe, swapIds, cookingFor]
  );
  const eaters = cookingForPeople(household, cookingFor);

  if (!recipe) {
    return (
      <EmptyState title="No sample recipes" body="This prototype should ship with pesto pasta." />
    );
  }

  if (household.people.length === 0) {
    return (
      <EmptyState
        title="Add people first"
        body="Once someone is in the household, we’ll mark who can eat each recipe."
      />
    );
  }

  function setMode(mode: CookingFor["mode"]) {
    if (mode === "custom") {
      setCustomOpen(true);
      return;
    }
    setCookingFor({ mode });
  }

  return (
    <div className="olp-stack">
      <div className="olp-section-head">
        <div>
          <p className="olp-kicker">Who can eat this</p>
          <h1>{recipe.title}</h1>
          <p className="olp-muted">
            {recipe.lede} · {recipe.minutes} min · {recipe.servings} servings
          </p>
        </div>
      </div>

      <div className="olp-recipe-hero" data-testid="who-can-eat">
        <div className="olp-recipe-emoji" aria-hidden="true">
          {recipe.emoji}
        </div>
        <div>
          <p className="olp-kicker">Cooking for</p>
          <Segmented
            label="Cooking for"
            value={cookingFor.mode}
            onChange={setMode}
            options={[
              { value: "everyone", label: "Everyone" },
              { value: "kids", label: "Kids" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {cookingFor.mode === "custom" ? (
            <p className="olp-caption">
              {eaters.map((person) => person.name).join(", ") || "Pick people"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="olp-who-row" data-testid="avatar-marks">
        {findings.map((finding) => {
          const person = household.people.find((item) => item.id === finding.personId);
          if (!person) return null;
          return (
            <button
              key={person.id}
              type="button"
              className="olp-who-person"
              data-testid={`mark-${person.id}`}
              data-mark={finding.mark}
              onClick={() => setExplain(finding)}
            >
              <Avatar person={person} size={52} mark={finding.mark} />
              <span>{person.name}</span>
            </button>
          );
        })}
      </div>
      <p className="olp-hint">Tap a face to see why.</p>

      <section>
        <h2>Ingredients</h2>
        <ul className="olp-ingredients">
          {recipe.ingredients.map((ingredient) => {
            const swap = recipe.swaps.find(
              (item) => item.ingredientId === ingredient.id && swapIds.includes(item.id)
            );
            return (
              <li key={ingredient.id} className={swap ? "is-swapped" : undefined}>
                {swap ? swap.replacementName : ingredient.name}
              </li>
            );
          })}
        </ul>
      </section>

      {recipe.swaps.length > 0 ? (
        <section>
          <h2>Try a swap</h2>
          <div className="olp-swap-list">
            {recipe.swaps.map((swap) => {
              const on = swapIds.includes(swap.id);
              return (
                <button
                  key={swap.id}
                  type="button"
                  data-testid={`swap-${swap.id}`}
                  className={`olp-swap${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  onClick={() => toggleSwap(recipe.id, swap.id)}
                >
                  <b>{swap.label}</b>
                  <span>{on ? "Applied — marks update live." : swap.detail}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="olp-section-head">
          <h2>More recipes</h2>
          <p className="olp-caption">Same marks, filtered by who you&apos;re cooking for.</p>
        </div>
        {eaters.length === 0 ? (
          <EmptyState
            title="No one in this group"
            body="Kids mode needs someone marked as a kid. Custom needs at least one person."
          />
        ) : (
          <div className="olp-recipe-grid">
            {RECIPES.map((card) => {
              const cardFindings = checkRecipe(
                household,
                card,
                appliedSwaps[card.id] ?? [],
                cookingFor
              );
              const worst = worstOf(cardFindings.map((item) => item.mark));
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`olp-recipe-card${card.id === recipe.id ? " is-on" : ""}`}
                  onClick={() => setFeaturedRecipe(card.id)}
                >
                  <span className="olp-recipe-card-emoji" aria-hidden="true">
                    {card.emoji}
                  </span>
                  <b>{card.title}</b>
                  <small>
                    {card.minutes} min · {labelForMark(worst)}
                  </small>
                  <span className="olp-mini-faces">
                    {cardFindings.map((finding) => {
                      const person = household.people.find((item) => item.id === finding.personId);
                      if (!person) return null;
                      return (
                        <Avatar key={person.id} person={person} size={22} mark={finding.mark} />
                      );
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Sheet
        open={Boolean(explain)}
        title={explain?.title ?? "Who can eat this"}
        onClose={closeExplain}
      >
        {explain ? <p className="olp-lead">{explain.reason}</p> : null}
      </Sheet>

      <Sheet open={customOpen} title="Cooking for" onClose={closeCustom}>
        <p className="olp-lead">Pick anyone. Marks update for just this group.</p>
        <div className="olp-choice-list">
          {household.people.map((person) => {
            const on = customIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                className={`olp-choice${on ? " is-on" : ""}`}
                onClick={() =>
                  setCustomIds((current) =>
                    current.includes(person.id)
                      ? current.filter((id) => id !== person.id)
                      : [...current, person.id]
                  )
                }
              >
                <Avatar person={person} size={32} />
                <b>{person.name}</b>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="olp-btn olp-btn-primary"
          onClick={() => {
            setCookingFor({ mode: "custom", personIds: customIds });
            setCustomOpen(false);
          }}
        >
          Use this group
        </button>
      </Sheet>
    </div>
  );
}

function worstOf(marks: Mark[]): Mark {
  if (marks.includes("block")) return "block";
  if (marks.includes("warn")) return "warn";
  return "ok";
}

function labelForMark(mark: Mark): string {
  if (mark === "block") return "blocked for someone";
  if (mark === "warn") return "check first";
  return "clear for this group";
}
