"use client";

import { useMemo, useState } from "react";
import type { Person, PersonRule } from "@ovenlovin/core";
import { Avatar, Sheet } from "@/components/people/ui";
import { appearanceForPerson } from "@/lib/person-appearance";
import {
  swapsForIngredients,
  whoCanEat,
  type CheckableIngredient,
  type WhoCanEatPerson,
} from "@/lib/who-can-eat";
import "@/app/prototype/people/prototype.css";
import "@/components/people/people.css";

export function WhoCanEat({
  people,
  rules,
  ingredients,
}: {
  people: Person[];
  rules: PersonRule[];
  ingredients: CheckableIngredient[];
}) {
  const [applied, setApplied] = useState<string[]>([]);
  const [selected, setSelected] = useState<WhoCanEatPerson | null>(null);
  const result = useMemo(
    () => whoCanEat({ people, rules, ingredients, appliedSwapIds: applied }),
    [people, rules, ingredients, applied]
  );
  const swaps = useMemo(() => swapsForIngredients(ingredients), [ingredients]);

  if (people.length === 0) return null;

  return (
    <div className="who-can-eat">
      <h2 className="who-can-eat-title">Who can eat this</h2>
      {result.status === "incomplete" ? (
        <p className="olp-lead" data-testid="who-incomplete">
          This check is incomplete
          {result.incompleteReasons[0] ? ` — ${result.incompleteReasons[0]}` : "."} Not a clean
          bill.
        </p>
      ) : null}
      <div className="olp-who-row" data-testid="who-can-eat">
        {result.people.map((item) => {
          const person = people.find((entry) => entry.id === item.personId);
          if (!person) return null;
          return (
            <button
              key={item.personId}
              type="button"
              className="olp-who-person"
              data-testid={`mark-${item.personId}`}
              data-mark={item.mark}
              onClick={() => setSelected(item)}
            >
              <Avatar
                name={item.personName}
                appearance={appearanceForPerson(person)}
                size={44}
                mark={item.mark}
              />
              <span>{item.personName}</span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <Sheet open title={selected.title} onClose={() => setSelected(null)}>
          <div className="olp-stack-sm">
            {selected.reasons.map((reason) => (
              <p key={reason} className="olp-lead">
                {reason}
              </p>
            ))}
            {swaps.length > 0 ? (
              <div className="olp-swap-list">
                {swaps.map((swap) => {
                  const on = applied.includes(swap.id);
                  return (
                    <button
                      key={swap.id}
                      type="button"
                      className={`olp-swap${on ? " is-on" : ""}`}
                      onClick={() =>
                        setApplied((current) =>
                          current.includes(swap.id)
                            ? current.filter((id) => id !== swap.id)
                            : [...current, swap.id]
                        )
                      }
                    >
                      <b>{on ? "Undo swap" : "Try this swap"}</b>
                      <span>{swap.substitutionNotes}</span>
                    </button>
                  );
                })}
              </div>
            ) : selected.mark !== "ok" ? (
              <p className="olp-hint">
                No stored swap for this recipe. Reasons only — we do not invent a substitute.
              </p>
            ) : null}
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
