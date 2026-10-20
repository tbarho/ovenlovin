"use client";

import { iosShortcutUrl } from "@/lib/ios-shortcut";
import { ImportBookmarklet } from "./ImportBookmarklet";

export function ImportFromDevice({
  origin,
  shortcutUrl,
}: {
  origin?: string;
  shortcutUrl?: string;
}) {
  const host =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const addShortcutHref = shortcutUrl !== undefined ? shortcutUrl.trim() : iosShortcutUrl();
  const showAddButton = Boolean(addShortcutHref);

  return (
    <div className="import-device">
      <details className="import-disclose">
        <summary>Save from Safari on iPhone</summary>
        <ol>
          <li>Open Settings and create an API key, or copy the demo key.</li>
          <li>
            In the Shortcuts app, create a shortcut that receives Safari web pages from the share
            sheet.
          </li>
          <li>Get the page URL and the HTML of the page.</li>
          <li>
            POST that to <code>{host}/api/v1/recipes/import/page</code> with header{" "}
            <code>Authorization: ApiKey YOUR_KEY</code> and JSON{" "}
            <code>{`{ "url": page URL, "html": page HTML }`}</code>.
          </li>
          <li>Open the recipe id that comes back.</li>
        </ol>
        {showAddButton ? (
          <p>
            <a className="btn primary" href={addShortcutHref}>
              Add the OvenLovin Shortcut
            </a>
          </p>
        ) : null}
      </details>
      <details className="import-disclose">
        <summary>Bookmarklet for desktop browsers</summary>
        <ImportBookmarklet origin={host} />
      </details>
    </div>
  );
}
