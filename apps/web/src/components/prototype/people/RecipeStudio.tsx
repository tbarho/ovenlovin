"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { tapFeedback } from "./haptics";
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
  const blocked = findings.filter((item) => item.mark === "block").length;
  const warned = findings.filter((item) => item.mark === "warn").length;

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

      <section>
        <div className="olp-stack-faces" aria-hidden="true">
          {findings.map((finding) => {
            const person = household.people.find((item) => item.id === finding.personId);
            if (!person) return null;
            return <Avatar key={person.id} person={person} size={36} mark={finding.mark} />;
          })}
        </div>
        <p className="olp-hero-line">
          {blocked === 0 && warned === 0
            ? "Everyone here can eat this."
            : blocked === 0
              ? "Clear with a couple of check-ins."
              : `${blocked} ${blocked === 1 ? "person needs" : "people need"} a swap.`}
        </p>
      </section>

      <div className="olp-who-row" data-testid="avatar-marks">
        {findings.map((finding) => {
          const person = household.people.find((item) => item.id === finding.personId);
          if (!person) return null;
          return (
            <motion.button
              key={person.id}
              type="button"
              className="olp-who-person"
              data-testid={`mark-${person.id}`}
              data-mark={finding.mark}
              layout
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                tapFeedback(10);
                setExplain(finding);
              }}
            >
              <Avatar person={person} size={58} mark={finding.mark} />
              <span>{person.name}</span>
            </motion.button>
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
                <motion.button
                  key={swap.id}
                  type="button"
                  data-testid={`swap-${swap.id}`}
                  className={`olp-swap${on ? " is-on" : ""}`}
                  aria-pressed={on}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    tapFeedback(12);
                    toggleSwap(recipe.id, swap.id);
                  }}
                >
                  <b>{swap.label}</b>
                  <span>{on ? "Applied — marks update live." : swap.detail}</span>
                </motion.button>
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
  return (
    <div className="olp-stack-sm">
      <p className="olp-lead">{finding.reason}</p>
      {finding.ingredientName ? (
        <p className="olp-caption">Ingredient: {finding.ingredientName}</p>
      ) : null}
    </div>
  );
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
      <p className="olp-lead">Pick anyone. Marks update for just this group.</p>
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
        Use this group
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
  if (mark === "block") return "blocked for someone";
  if (mark === "warn") return "check first";
  return "clear for this group";
}
