import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookReader } from "@/components/kitchen/BookReader";
import { loadSharedBook } from "@/lib/cookbook-share";
import { getPublicDemoUrl } from "@/lib/demo/mode";
import { isBooksEnabled } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Unlisted, signed-out reader for a shared cookbook. Revoked or blocked links 404. */
export default async function SharedBookPage({ params }: { params: Promise<{ token: string }> }) {
  if (!isBooksEnabled()) notFound();
  const { token } = await params;
  const book = await loadSharedBook(token);
  if (!book) notFound();
  // "Cook this" in a shared book: there is no kitchen to open, so try the demo or sign up.
  return <BookReader book={book} shared cookHref={getPublicDemoUrl() ?? "/sign-up"} />;
}
