import { notFound } from "next/navigation";
import { z } from "zod";
import { BookContents } from "@/components/kitchen/BookContents";
import { loadBookContents } from "@/lib/book-import-view";
import { isBooksEnabled, jobQueue } from "@/lib/jobs";
import { requireKitchenContext } from "@/lib/kitchen-session";

export default async function BookContentsPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isBooksEnabled()) notFound();
  const context = await requireKitchenContext();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const view = await loadBookContents(jobQueue(), id, context.householdId);
  if (!view) notFound();
  return <BookContents initial={view} />;
}
