import type { LoveHit } from "@ovenlovin/allergens";
import { loveTagText, type RecipeSafetySummary } from "@/lib/recipe-card-safety";

export function LoveTags({
  hits,
  warningPersonIds = [],
  blockPersonIds = [],
  blockTitles = [],
}: {
  hits: LoveHit[];
  warningPersonIds?: Iterable<string>;
  blockPersonIds?: Iterable<string>;
  blockTitles?: string[];
}) {
  const safety: Pick<RecipeSafetySummary, "blockPersonIds" | "warnPersonIds"> = {
    blockPersonIds: [...blockPersonIds],
    warnPersonIds: [...warningPersonIds],
  };
  const tags = hits
    .map((hit) => {
      const text = loveTagText(hit, safety);
      if (!text) return null;
      return { key: `${hit.personId}:${hit.value}`, text };
    })
    .filter((tag): tag is { key: string; text: string } => Boolean(tag));
  const unique = [...new Map(tags.map((tag) => [tag.text, tag])).values()];
  if (unique.length === 0 && blockTitles.length === 0) return null;
  return (
    <p className="love-tags" data-testid="love-tags">
      {blockTitles.map((text) => (
        <span key={text} className="who-chip who-chip-block" data-testid="block-headline">
          {text}
        </span>
      ))}
      {unique.map((tag) => (
        <span key={tag.key} className="love-tag">
          {tag.text}
        </span>
      ))}
    </p>
  );
}
