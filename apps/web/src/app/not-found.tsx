import Link from "next/link";
import { AppChrome } from "@/components/kitchen/AppChrome";

export default function NotFound() {
  return (
    <AppChrome>
      <div className="kitchen-head">
        <div>
          <h1>Page not found</h1>
          <p className="muted">That page isn&apos;t in this kitchen.</p>
        </div>
      </div>
      <Link className="btn primary" href="/recipes">
        Back to recipes
      </Link>
    </AppChrome>
  );
}
