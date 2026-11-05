import Link from "next/link";
import "@/components/ui/ui.css";

const backToPeopleClass = "ds-button ds-button--default ds-button--md";

export default function PeopleNotFound() {
  return (
    <div className="not-found">
      <h1>We couldn&apos;t find that page</h1>
      <p>It may have been moved, or the link is out of date.</p>
      <Link className={backToPeopleClass} href="/people">
        Back to people
      </Link>
    </div>
  );
}
