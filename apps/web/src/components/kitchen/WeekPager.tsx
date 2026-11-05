import Link from "next/link";
import "@/components/ui/ui.css";
import { addDays } from "@/lib/week-plan-view";

const weekLinkClass = "ds-button ds-button--secondary ds-button--sm btn compact";

export function WeekPager({ weekStart }: { weekStart: string }) {
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  return (
    <nav className="week-pager" aria-label="Week">
      <Link className={weekLinkClass} href={`/plans?week=${previous}`}>
        Previous week
      </Link>
      <Link className={weekLinkClass} href={`/plans?week=${next}`}>
        Next week
      </Link>
    </nav>
  );
}
