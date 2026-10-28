/**
 * Contents map for a whole-cookbook PDF. Pure and deterministic: text lines in,
 * candidate recipes out. Client-safe (no db imports) so the contents screen can
 * share the search and grouping helpers.
 */

/** One PDF page. `page` is 1-based. No lines means no text layer (scanned). */
export type PdfPageText = { page: number; lines: string[] };

export type ContentsSource = "contents" | "index" | "pages" | "none";

export type ContentsCandidate = {
  id: string;
  title: string;
  group: string | null;
  printedPage: number | null;
  pdfPage: number | null;
};

export type ContentsMap = {
  source: ContentsSource;
  /** PDF page minus printed page (front matter shift). */
  offset: number;
  calibrated: boolean;
  mapPages: number[];
  scannedPages: number[];
  candidates: ContentsCandidate[];
};

const ENTRY = /^(.{2,90}?)[\s.·…_-]*[\s.·…_](\d{1,4})$/;
const INDEX_ENTRY = /^(.{2,90}?),\s*(\d{1,4}(?:\s*[,-]\s*\d{1,4})*)$/;
const CONTENTS_HEADING = /^(table of )?contents$/i;
const INDEX_HEADING = /^(recipe )?index$/i;
const PAGE_NUMBER = /^\d{1,4}$/;
const FRACTION = "[½¼¾⅓⅔⅛⅜⅝⅞]";
const INGREDIENT = new RegExp(
  `^(\\d+([/.,]\\d+)?(\\s*(-|to)\\s*\\d+)?\\s*${FRACTION}?|${FRACTION}|(a|an|one|two|three|four|six|twelve|pinch of|handful of)\\s)\\s*\\S`,
  "i"
);
const NOT_A_TITLE = /^(serves|makes|yield|ingredients|method|directions|step|prep|cook|total)\b/i;

const clean = (line: string) => line.replace(/\s+/g, " ").trim();

export const normalizeTitle = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slug = (value: string) => normalizeTitle(value).replace(/ /g, "-").slice(0, 60);

const textLines = (page: PdfPageText) => page.lines.map(clean).filter(Boolean);

function parseEntry(line: string) {
  if (PAGE_NUMBER.test(line)) return null;
  const match = line.match(ENTRY);
  if (!match) return null;
  const title = clean(match[1]!.replace(/[\s.·…_-]+$/, ""));
  if (!/[a-z]/i.test(title)) return null;
  if (INGREDIENT.test(title) || NOT_A_TITLE.test(title)) return null;
  return { title, printedPage: Number(match[2]) };
}

function parseIndexEntry(line: string) {
  const match = line.match(INDEX_ENTRY);
  if (!match) {
    const entry = parseEntry(line);
    return entry ? { ...entry, pages: [entry.printedPage] } : null;
  }
  const pages = match[2]!.split(/[,-]/).map((value) => Number(value.trim()));
  return { title: clean(match[1]!), printedPage: pages[0]!, pages };
}

const entryRatio = (lines: string[]) =>
  lines.length === 0 ? 0 : lines.filter((line) => parseEntry(line)).length / lines.length;

const ascending = (numbers: number[]) =>
  numbers.length > 1 &&
  numbers.every((value, index) => index === 0 || value >= numbers[index - 1]!);

const headingPage = (page: PdfPageText, heading: RegExp) =>
  textLines(page)
    .slice(0, 4)
    .some((line) => heading.test(line));

/** A run of pages starting at a heading page, continuing while pages stay entry-dense. */
function runFrom(pages: PdfPageText[], start: number) {
  const run = [pages[start]!];
  for (const page of pages.slice(start + 1)) {
    if (entryRatio(textLines(page)) < 0.5) break;
    run.push(page);
  }
  return run;
}

/** Contents: a "Contents" heading, or an entry-dense page with ascending numbers in the front fifth. */
export function findContentsPages(pages: PdfPageText[]) {
  const headed = pages.findIndex((page) => headingPage(page, CONTENTS_HEADING));
  if (headed >= 0) return runFrom(pages, headed);
  const front = Math.max(3, Math.ceil(pages.length / 5));
  const dense = pages.slice(0, front).findIndex((page) => {
    const lines = textLines(page);
    const numbers = lines.flatMap((line) => parseEntry(line)?.printedPage ?? []);
    return lines.length >= 5 && entryRatio(lines) >= 0.6 && ascending(numbers);
  });
  return dense >= 0 ? runFrom(pages, dense) : [];
}

export function findIndexPages(pages: PdfPageText[]) {
  const headed = pages.reduce(
    (memo, page, at) => (headingPage(page, INDEX_HEADING) ? at : memo),
    -1
  );
  if (headed < 0) return [];
  const run = [pages[headed]!];
  for (const page of pages.slice(headed + 1)) {
    const lines = textLines(page);
    if (lines.filter((line) => parseIndexEntry(line)).length / Math.max(lines.length, 1) < 0.5)
      break;
    run.push(page);
  }
  return run;
}

type Entry = { title: string; printedPage: number; group: string | null };

function contentsEntries(mapPages: PdfPageText[]) {
  return mapPages.reduce(
    (memo: { group: string | null; entries: Entry[] }, page) =>
      textLines(page).reduce((inner, line) => {
        if (CONTENTS_HEADING.test(line) || PAGE_NUMBER.test(line)) return inner;
        const entry = parseEntry(line);
        if (!entry) return line.length <= 40 ? { ...inner, group: line } : inner;
        return { ...inner, entries: [...inner.entries, { ...entry, group: inner.group }] };
      }, memo),
    { group: null, entries: [] }
  ).entries;
}

/** Index entries that point at exactly one page: recipes, not ingredients cited all over. */
function indexEntries(mapPages: PdfPageText[]) {
  return mapPages
    .flatMap((page) => textLines(page))
    .filter((line) => !INDEX_HEADING.test(line))
    .flatMap((line) => {
      const entry = parseIndexEntry(line);
      if (!entry || entry.pages.length !== 1) return [];
      return [{ title: entry.title, printedPage: entry.printedPage, group: null }];
    });
}

const titleOnPage = (page: PdfPageText | undefined, title: string) => {
  if (!page) return false;
  const wanted = normalizeTitle(title);
  return textLines(page)
    .slice(0, 6)
    .some((line) => normalizeTitle(line) === wanted);
};

/**
 * Printed-page to PDF-page offset. Every entry votes for each offset where its
 * title heads a page; the offset most entries agree on wins. Two or more
 * agreeing finds (or the only entry) counts as calibrated.
 */
export function calibrateOffset(entries: Entry[], pages: PdfPageText[], skip: number[] = []) {
  const votes = entries.reduce((memo, entry) => {
    const offsets = new Set(
      pages
        .filter((page) => !skip.includes(page.page) && titleOnPage(page, entry.title))
        .map((page) => page.page - entry.printedPage)
    );
    offsets.forEach((offset) => memo.set(offset, (memo.get(offset) ?? 0) + 1));
    return memo;
  }, new Map<number, number>());
  const [best] = [...votes.entries()].sort(
    (a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0])
  );
  if (!best) return { offset: 0, calibrated: false };
  return { offset: best[0], calibrated: best[1] >= Math.min(2, entries.length) };
}

function withIds(candidates: Omit<ContentsCandidate, "id">[]) {
  return candidates.reduce((memo: ContentsCandidate[], candidate) => {
    const base = `${candidate.printedPage ?? `p${candidate.pdfPage}`}-${slug(candidate.title)}`;
    const taken = memo.filter((item) => item.id === base || item.id.startsWith(`${base}~`)).length;
    return [...memo, { ...candidate, id: taken ? `${base}~${taken + 1}` : base }];
  }, []);
}

export const isIngredient = (line: string) => INGREDIENT.test(line) && line.length <= 80;

/** No contents or index: a page with a title near the top and three or more ingredient lines. */
export function detectRecipePages(pages: PdfPageText[]) {
  return pages.flatMap((page) => {
    const lines = textLines(page).filter((line) => !PAGE_NUMBER.test(line));
    if (lines.filter(isIngredient).length < 3) return [];
    const title = lines
      .slice(0, 4)
      .find(
        (line) =>
          line.length >= 3 &&
          line.length <= 80 &&
          /[a-z]/i.test(line) &&
          !isIngredient(line) &&
          !NOT_A_TITLE.test(line) &&
          !/[.:]$/.test(line)
      );
    return title ? [{ title, group: null, printedPage: null, pdfPage: page.page }] : [];
  });
}

export function buildContentsMap(pages: PdfPageText[]): ContentsMap {
  const scannedPages = pages
    .filter((page) => textLines(page).length === 0)
    .map((page) => page.page);
  const empty = { offset: 0, calibrated: false, scannedPages };

  const contents = findContentsPages(pages);
  const index = findIndexPages(pages);
  const fromContents = contentsEntries(contents);
  const fromIndex = indexEntries(index);
  const [source, mapPages, entries] =
    fromContents.length > 0
      ? (["contents", contents, fromContents] as const)
      : (["index", index, fromIndex] as const);

  if (entries.length > 0) {
    const skip = mapPages.map((page) => page.page);
    const { offset, calibrated } = calibrateOffset(entries, pages, skip);
    const ordered =
      source === "index" ? [...entries].sort((a, b) => a.printedPage - b.printedPage) : entries;
    return {
      source,
      offset,
      calibrated,
      mapPages: skip,
      scannedPages,
      candidates: withIds(
        ordered.map((entry) => ({ ...entry, pdfPage: entry.printedPage + offset }))
      ),
    };
  }

  const found = detectRecipePages(pages);
  if (found.length > 0) {
    return { ...empty, source: "pages", mapPages: [], candidates: withIds(found) };
  }
  return { ...empty, source: "none", mapPages: [], candidates: [] };
}

/** An index photo: a heading, or most lines in "Title, 112" form. */
const isIndexPhoto = (page: PdfPageText) => {
  const lines = textLines(page);
  if (headingPage(page, INDEX_HEADING)) return true;
  const commas = lines.filter((line) => INDEX_ENTRY.test(line)).length;
  return lines.length > 0 && commas / lines.length >= 0.5;
};

/**
 * Contents map from photos of a paper book's contents or index pages. Every
 * photo is a map page (the person said so), so no heading is needed. The
 * printed page is the only page there is: no offset, nothing to calibrate.
 * Contents entries keep their order and sections; index-only entries follow
 * in page order. Index lines citing several pages are ingredients, not recipes.
 */
export function buildPhotoContentsMap(pages: PdfPageText[]): ContentsMap {
  const fromContents = contentsEntries(pages.filter((page) => !isIndexPhoto(page)));
  const known = new Set(fromContents.map((entry) => normalizeTitle(entry.title)));
  const fromIndex = indexEntries(pages.filter(isIndexPhoto))
    .filter((entry) => !known.has(normalizeTitle(entry.title)))
    .sort((a, b) => a.printedPage - b.printedPage);
  const entries = [...fromContents, ...fromIndex];
  const source = fromContents.length > 0 ? "contents" : fromIndex.length > 0 ? "index" : "none";
  return {
    source,
    offset: 0,
    calibrated: entries.length > 0,
    mapPages: [],
    scannedPages: [],
    candidates: withIds(entries.map((entry) => ({ ...entry, pdfPage: null }))),
  };
}

/** Contents screen helpers. */
export const OTHER_GROUP = "Recipes";

export function searchCandidates(candidates: ContentsCandidate[], query: string) {
  const wanted = normalizeTitle(query);
  if (!wanted) return candidates;
  return candidates.filter((candidate) =>
    normalizeTitle(`${candidate.title} ${candidate.group ?? ""}`).includes(wanted)
  );
}

export function groupCandidates(candidates: ContentsCandidate[]) {
  return candidates.reduce((memo: { name: string; items: ContentsCandidate[] }[], candidate) => {
    const name = candidate.group ?? OTHER_GROUP;
    const last = memo[memo.length - 1];
    if (last?.name === name) {
      last.items.push(candidate);
      return memo;
    }
    return [...memo, { name, items: [candidate] }];
  }, []);
}

/** Picks default to everything. Unknown ids are dropped. */
export function resolvePicks(candidates: ContentsCandidate[], picks: string[] | undefined | null) {
  const ids = candidates.map((candidate) => candidate.id);
  if (!picks) return ids;
  return ids.filter((id) => picks.includes(id));
}
