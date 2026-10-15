import type { LoveHit } from "@ovenlovin/allergens";

export function LoveTags({
  hits,
  warningPersonIds = [],
}: {
  hits: LoveHit[];
  warningPersonIds?: Iterable<string>;
}) {
  if (hits.length === 0) return null;
  const warnings = new Set(warningPersonIds);
  const tags = hits.map((hit) => ({
    key: `${hit.personId}:${hit.value}`,
    text: warnings.has(hit.personId) ? `${hit.personName} loves this — check first` : hit.tag,
  }));
  const unique = [...new Map(tags.map((tag) => [tag.text, tag])).values()];
  return (
    <p className="love-tags" data-testid="love-tags">
      {unique.map((tag) => (
        <span key={tag.key} className="love-tag">
          {tag.text}
        </span>
      ))}
    </p>
  );
}
