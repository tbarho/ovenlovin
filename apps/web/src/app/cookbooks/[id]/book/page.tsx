import { notFound } from "next/navigation";
import { z } from "zod";
import { BookReader } from "@/components/kitchen/BookReader";
import { loadReaderBook } from "@/lib/book-reader";
import { DEMO_PDF_OFF, isDemoModeEnabled } from "@/lib/demo/mode";
import { isBooksEnabled } from "@/lib/jobs";
import { requireKitchenContext } from "@/lib/kitchen-session";

export default async function CookbookBookPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isBooksEnabled()) notFound();
  const context = await requireKitchenContext();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const book = await loadReaderBook(id, context.householdId);
  if (!book) notFound();
  return <BookReader book={book} printBlocked={isDemoModeEnabled() ? DEMO_PDF_OFF : null} />;
}
