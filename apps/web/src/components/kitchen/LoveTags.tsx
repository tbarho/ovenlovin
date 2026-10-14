import type { LoveHit } from "@ovenlovin/allergens";

export function LoveTags({ hits }: { hits: LoveHit[] }) {
  if (hits.length === 0) return null;
  const tags = [...new Set(hits.map((hit) => hit.tag))];
  return (
    <p className="love-tags" data-testid="love-tags">
      {tags.map((tag) => (
        <span key={tag} className="love-tag">
          {tag}
        </span>
      ))}
    </p>
  );
}
