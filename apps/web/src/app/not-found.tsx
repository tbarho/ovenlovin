import Link from "next/link";
import { AppChrome } from "@/components/kitchen/AppChrome";

export default function NotFound() {
  return (
    <AppChrome>
      <div className="kitchen-head">
        <div>
          <p className="badge">
            <i />
            Missing page
          </p>
          <h1>We couldn&apos;t find that page</h1>
          <p className="muted">It may have been moved, or the link is out of date.</p>
        </div>
        <div className="recipe-actions" style={{ margin: 0 }}>
          <Link className="btn primary" href="/recipes">
            Back to recipes
          </Link>
        </div>
      </div>
    </AppChrome>
  );
}
