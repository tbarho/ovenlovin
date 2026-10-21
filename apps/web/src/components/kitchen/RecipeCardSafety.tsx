import type { PersonLove, RecipeLoveFields } from "@ovenlovin/allergens";
import { loveHitsForRecipe } from "@/lib/household-loves";
import { EMPTY_RECIPE_SAFETY, type RecipeSafetySummary } from "@/lib/recipe-card-safety";
import { LoveTags } from "./LoveTags";

export function RecipeCardSafety({
  recipe,
  lovePeople,
  safety = EMPTY_RECIPE_SAFETY,
}: {
  recipe: RecipeLoveFields;
  lovePeople: PersonLove[];
  safety?: RecipeSafetySummary;
}) {
  return (
    <>
      <LoveTags
        hits={loveHitsForRecipe(recipe, lovePeople)}
        blockPersonIds={safety.blockPersonIds}
        warningPersonIds={safety.warnPersonIds}
        blockTitles={safety.blockTitles ?? []}
      />
      {safety.warnings.length > 0 ? (
        <ul className="recipe-card-warnings" data-testid="recipe-card-warnings">
          {safety.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
