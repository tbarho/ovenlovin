import Link from "next/link";
import { addDays } from "@/lib/week-plan-view";

export function WeekPager({ weekStart }: { weekStart: string }) {
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  return (
    <nav className="week-pager" aria-label="Week">
      <Link className="btn compact" href={`/plans?week=${previous}`}>
        Previous week
      </Link>
      <Link className="btn compact" href={`/plans?week=${next}`}>
        Next week
      </Link>
    </nav>
  );
}
