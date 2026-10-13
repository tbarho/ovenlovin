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
import { Avatar, EmptyState, Segmented, Sheet } from "./ui";

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
      <EmptyState title="Add people first" body="Marks show up once someone is in the household." />
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
      <header>
        <h1>{recipe.title}</h1>
        <p className="olp-muted">
          {recipe.lede} · {recipe.minutes} min
        </p>
      </header>

      <section data-testid="who-can-eat">
        <h2>Who can eat this</h2>
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
                <Avatar person={person} size={58} mark={finding.mark} />
                <span>{person.name}</span>
              </button>
            );
          })}
        </div>
      </section>

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
          <h2>Swap</h2>
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
                  <span>{on ? "Applied" : swap.detail}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section>
        <h2>More recipes</h2>
        {eaters.length === 0 ? (
          <EmptyState
            title="No one in this group"
            body="Kids mode needs a kid. Custom needs at least one person."
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
        {explain ? <FindingDetail finding={explain} /> : null}
      </Sheet>

      <Sheet open={customOpen} title="Cooking for" onClose={closeCustom}>
        <CustomCookForm
          people={household.people}
          selectedIds={customIds}
          onToggle={(personId) =>
            setCustomIds((current) =>
              current.includes(personId)
                ? current.filter((id) => id !== personId)
                : [...current, personId]
            )
          }
          onApply={() => {
            setCookingFor({ mode: "custom", personIds: customIds });
            setCustomOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}

function FindingDetail({ finding }: { finding: Finding }) {
  return <p className="olp-lead">{finding.reason}</p>;
}

function CustomCookForm({
  people,
  selectedIds,
  onToggle,
  onApply,
}: {
  people: { id: string; name: string; emoji: string; color: string }[];
  selectedIds: string[];
  onToggle: (personId: string) => void;
  onApply: () => void;
}) {
  return (
    <>
      <div className="olp-choice-list">
        {people.map((person) => {
          const on = selectedIds.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              className={`olp-choice${on ? " is-on" : ""}`}
              onClick={() => onToggle(person.id)}
            >
              <Avatar person={person} size={32} />
              <b>{person.name}</b>
            </button>
          );
        })}
      </div>
      <button type="button" className="olp-btn olp-btn-primary" onClick={onApply}>
        Done
      </button>
    </>
  );
}

function worstOf(marks: Mark[]): Mark {
  if (marks.includes("block")) return "block";
  if (marks.includes("warn")) return "warn";
  return "ok";
}

function labelForMark(mark: Mark): string {
  if (mark === "block") return "blocked";
  if (mark === "warn") return "check first";
  return "clear";
}
