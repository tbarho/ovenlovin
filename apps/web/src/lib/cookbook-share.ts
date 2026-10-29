import { CookbookService, CookbookShareService, type CookbookShareStatus } from "@ovenlovin/core";
import { getDatabase } from "@ovenlovin/db";
import { loadReaderBook, type ReaderBook } from "@/lib/book-reader";
import { DEMO_SHARE_OFF, isDemoModeEnabled } from "@/lib/demo/mode";

export const sharedBookPath = (token: string) => `/read/${token}`;

/** The share status as the API and cookbook page hand it out. The public demo never shares. */
export function presentShare(status: CookbookShareStatus) {
  if (isDemoModeEnabled()) return { path: null, blocked: DEMO_SHARE_OFF };
  return {
    path: status.token ? sharedBookPath(status.token) : null,
    blocked: status.blocked,
  };
}

export type SharedBookDeps = {
  shares?: Pick<CookbookShareService, "resolveLink">;
  cookbooks?: Pick<CookbookService, "getCookbook">;
  load?: (cookbookId: string, householdId: string) => Promise<ReaderBook | null>;
};

/** The book behind a live share link, laid out for a signed-out reader. Null means 404. */
export async function loadSharedBook(
  token: string,
  deps: SharedBookDeps = {}
): Promise<ReaderBook | null> {
  const db = deps.shares && deps.cookbooks ? null : getDatabase();
  const shares = deps.shares ?? new CookbookShareService(db!);
  const cookbooks = deps.cookbooks ?? new CookbookService(db!);
  const load = deps.load ?? loadReaderBook;

  if (isDemoModeEnabled()) return null;
  const cookbookId = await shares.resolveLink(token);
  if (!cookbookId) return null;
  const cookbook = await cookbooks.getCookbook(cookbookId);
  if (!cookbook) return null;
  return load(cookbook.id, cookbook.householdId);
}
