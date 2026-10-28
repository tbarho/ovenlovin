import { notFound } from "next/navigation";
import { PRINT_SPEC, printSheet } from "@ovenlovin/core/book";
import { BookPage } from "@/components/kitchen/BookPage";
import { bookFingerprint, loadPrintBook, printMode, PX, readPrintToken } from "@/lib/book-print";
import { isBooksEnabled } from "@/lib/jobs";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Household from the renderer's signed pass, else the signed-in kitchen. */
async function householdFor(id: string, token: unknown) {
  const granted = readPrintToken(token, id);
  if (granted) return granted;
  const context = await getSessionContext({ allowRedirect: false }).catch(() => null);
  return context?.householdId ?? null;
}

/** Corner crop marks in the slug, stopping short of the bleed so they never print on the page. */
function CropMarks({ w, h }: { w: number; h: number }) {
  const pad = (PRINT_SPEC.bleed + PRINT_SPEC.slug) * PX;
  const reach = PRINT_SPEC.slug * PX - 4;
  const corners = [
    [pad, pad, -1, -1],
    [w - pad, pad, 1, -1],
    [pad, h - pad, -1, 1],
    [w - pad, h - pad, 1, 1],
  ];
  const gap = PRINT_SPEC.bleed * PX + 2;
  return (
    <svg className="print-marks" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {corners.map(([x, y, dx, dy], i) => (
        <g key={i} stroke="#000" strokeWidth={0.5}>
          <line x1={x! + dx! * gap} y1={y} x2={x! + dx! * (gap + reach)} y2={y} />
          <line x1={x} y1={y! + dy! * gap} x2={x} y2={y! + dy! * (gap + reach)} />
        </g>
      ))}
    </svg>
  );
}

/**
 * The book at fixed US Letter, one sheet per printed page, for headless
 * Chromium to turn into PDF. Same `paginate` pages and `BookPage` kinds as
 * the reader; a print shop gets bleed and crop marks around the same layout.
 */
export default async function PrintCookbookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  if (!isBooksEnabled()) notFound();
  const { id } = await params;
  const search = await searchParams;
  const householdId = await householdFor(id, one(search.token));
  if (!householdId) notFound();
  const book = await loadPrintBook(id, householdId);
  if (!book) notFound();

  const mode = printMode(one(search.mode));
  const total = book.pages.length;
  const from = Math.max(1, Number(one(search.from)) || 1);
  const to = Math.min(total, Number(one(search.to)) || total);
  const sheet = printSheet(mode);
  const size = { w: PRINT_SPEC.trimW * PX, h: PRINT_SPEC.trimH * PX };
  const sheetPx = { w: sheet.w * PX, h: sheet.h * PX };

  return (
    <main
      className={`print-book print-book--${mode}`}
      data-book-sha={bookFingerprint(book.id, mode, book.pages)}
      data-page-count={total}
      data-from={from}
      data-to={to}
      style={
        {
          "--print-bleed": `${PRINT_SPEC.bleed * PX}px`,
          "--print-slug": `${PRINT_SPEC.slug * PX}px`,
        } as any
      }
    >
      <style>{`@page { size: ${sheet.w}in ${sheet.h}in; margin: 0; }`}</style>
      {book.pages.slice(from - 1, to).map((page: any) => (
        <section
          key={page.number}
          className="print-sheet"
          data-page={page.number}
          style={{ width: sheetPx.w, height: sheetPx.h }}
        >
          <div className="print-bleed">
            <BookPage page={page} size={size} bookId={book.id} print />
          </div>
          {mode === "shop" ? <CropMarks w={sheetPx.w} h={sheetPx.h} /> : null}
        </section>
      ))}
    </main>
  );
}
