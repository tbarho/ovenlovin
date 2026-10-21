import Link from "next/link";

export default function PeopleNotFound() {
  return (
    <div className="not-found">
      <h1>We couldn&apos;t find that page</h1>
      <p>It may have been moved, or the link is out of date.</p>
      <Link className="btn primary" href="/people">
        Back to people
      </Link>
    </div>
  );
}
