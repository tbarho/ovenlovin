/* eslint-disable @typescript-eslint/no-explicit-any */

export const PRINT_MODES = ["home", "shop"] as const;
export type PrintMode = (typeof PRINT_MODES)[number];

/**
 * US Letter trim for both modes. A print shop gets the same pages plus bleed
 * past the trim and a slug for crop marks - a toggle, not a second layout.
 * Inches; CSS px are 96 per inch, PDF points 72.
 */
export const PRINT_SPEC = {
  trimW: 8.5,
  trimH: 11,
  bleed: 0.125,
  slug: 0.25,
  minDpi: 300,
  chunkPages: 40,
};

/** Sheet size for a mode, in inches. */
export function printSheet(mode: PrintMode) {
  const s = PRINT_SPEC;
  const pad = mode === "shop" ? s.bleed + s.slug : 0;
  return { w: s.trimW + pad * 2, h: s.trimH + pad * 2, pad };
}

/**
 * Page ranges (1-based, inclusive) the PDF renders one at a time. Chunks break
 * where a chapter starts so a retry redoes one section, and never run past
 * `max` pages so each render fits one short worker call.
 */
export function printChunks(pages: any[], max = PRINT_SPEC.chunkPages) {
  return pages.reduce((memo: { from: number; to: number }[], page: any, i: number) => {
    const n = i + 1;
    const last = memo[memo.length - 1];
    const breaks = !last || page.kind === "section" || last.to - last.from + 1 >= max;
    if (breaks) return [...memo, { from: n, to: n }];
    last.to = n;
    return memo;
  }, []);
}
