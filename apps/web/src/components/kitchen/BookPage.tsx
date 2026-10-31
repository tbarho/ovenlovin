"use client";

import Link from "next/link";
import { forwardRef } from "react";

/** A duration label: "45 min", "1 hr", "1 hr 30 min". */
export function timeLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** "Serves 4 · 2 loaves · Prep 10 min · Cook 45 min" - only what the recipe knows. */
export function metaLine(header: any) {
  const parts: string[] = [];
  if (header.servings) parts.push(`Serves ${header.servings}`);
  if (header.yieldQuantity && header.yieldUnit)
    parts.push(`${header.yieldQuantity} ${header.yieldUnit}`);
  if (header.prepTimeMinutes) parts.push(`Prep ${timeLabel(header.prepTimeMinutes)}`);
  if (header.cookTimeMinutes) parts.push(`Cook ${timeLabel(header.cookTimeMinutes)}`);
  if (header.totalTimeMinutes) parts.push(`Total ${timeLabel(header.totalTimeMinutes)}`);
  return parts.join(" · ");
}

/** Photo pages carry their number inside the caption bar; the cover carries none. */
const NO_FOLIO = new Set(["cover", "photo", "original-card"]);
/**
 * One laid-out book page. The caption bar under photos is a flex row at the
 * bottom of the page, never an overlay on top of the photo.
 */
export const BookPage = forwardRef<
  HTMLDivElement,
  { page: any; size: { w: number; h: number }; bookId: string | null; print?: boolean }
>(function BookPage({ page, size, bookId, print = false }, ref) {
  const style = { width: size.w, height: size.h, fontSize: `${size.h / 56}px` };

  return (
    <div ref={ref} className={`book-page book-page--${page.kind}`} style={style}>
      {/* page-flip sets display: block on the page itself; the column lives one level in. */}
      <div className="book-page-in">
        {page.kind === "cover" ? <Cover page={page} /> : null}
        {page.kind === "dedication" ? <Dedication page={page} /> : null}
        {page.kind === "contents" ? <Contents page={page} /> : null}
        {page.kind === "section" ? <Section page={page} /> : null}
        {page.kind === "photo" ? <Photo page={page} bookId={bookId} print={print} /> : null}
        {page.kind === "original-card" ? (
          <OriginalCard page={page} bookId={bookId} print={print} />
        ) : null}
        {page.kind === "recipe" || page.kind === "recipe-cont" ? <Recipe page={page} /> : null}
        {page.kind === "index" ? <Index page={page} /> : null}
        {page.kind === "notes" ? <Notes /> : null}
        {page.kind === "colophon" ? <Colophon page={page} /> : null}
      </div>

      {NO_FOLIO.has(page.kind) ? null : <p className="book-page-number">{page.number}</p>}
    </div>
  );
});

function Cover({ page }: { page: any }) {
  return (
    <div className="book-cover">
      {page.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="book-cover-photo" src={page.image} alt="" />
      ) : null}
      <div className="book-cover-type">
        <p className="book-kicker">The family book</p>
        <h1>{page.title}</h1>
        {page.subtitle ? <p className="book-cover-subtitle">{page.subtitle}</p> : null}
      </div>
    </div>
  );
}

function Dedication({ page }: { page: any }) {
  return (
    <div className="book-centered">
      <p className="book-dedication">{page.text}</p>
    </div>
  );
}

function Contents({ page }: { page: any }) {
  return (
    <div className="book-body">
      <h2 className="book-heading">Contents{page.part > 1 ? ` · ${page.part}` : ""}</h2>
      <ol className="book-toc">
        {(page.entries ?? []).map((entry: any, i: number) => (
          <li key={i} className={entry.type === "section" ? "book-toc-section" : undefined}>
            <span className="book-toc-title">{entry.title}</span>
            <span className="book-toc-dots" aria-hidden="true" />
            <span className="book-toc-page">{entry.page}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ page }: { page: any }) {
  return (
    <div className="book-centered">
      <p className="book-kicker">Chapter</p>
      <h2 className="book-section-title">{page.title}</h2>
    </div>
  );
}

/** Links into the kitchen recipe. Paper has no links; shared books (null bookId) have no kitchen to link to. */
function RecipeTitle({
  page,
  bookId,
  print,
}: {
  page: any;
  bookId: string | null;
  print: boolean;
}) {
  if (print || !bookId) return <span>{page.title}</span>;
  return <Link href={`/recipes/${page.recipeId}?fromCookbook=${bookId}`}>{page.title}</Link>;
}

/** Photo opener. The caption bar sits below the photo, never on top of it. */
function Photo({ page, bookId, print }: { page: any; bookId: string | null; print: boolean }) {
  return (
    <div className="book-photo">
      <div className="book-photo-frame">
        {page.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.image} alt={page.title} />
        ) : (
          <div className="book-photo-typographic">
            <p className="book-kicker">Recipe</p>
            <h3>{page.title}</h3>
            {page.words ? <p className="book-words">{page.words}</p> : null}
          </div>
        )}
      </div>
      <div className="book-photo-caption">
        <RecipeTitle page={page} bookId={bookId} print={print} />
        <span className="book-photo-caption-page">p. {page.number}</span>
      </div>
    </div>
  );
}

function OriginalCard({
  page,
  bookId,
  print,
}: {
  page: any;
  bookId: string | null;
  print: boolean;
}) {
  return (
    <div className="book-photo">
      <div className="book-photo-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.image} alt={`Original card for ${page.title}`} />
      </div>
      <div className="book-photo-caption">
        <RecipeTitle page={page} bookId={bookId} print={print} />
        <span className="book-photo-caption-page">p. {page.number}</span>
      </div>
    </div>
  );
}

function Recipe({ page }: { page: any }) {
  return (
    <div className="book-body">
      {page.kind === "recipe-cont" ? (
        <p className="book-kicker">
          {page.title} · continued{page.part > 2 ? ` (${page.part})` : ""}
        </p>
      ) : null}
      <div className="book-recipe-blocks">
        {(page.blocks ?? []).map((block: any, i: number) => {
          if (block.type === "header") {
            const meta = metaLine(block);
            return (
              <header key={i} className="book-recipe-header">
                <h2>{block.title}</h2>
                {meta ? <p className="book-recipe-meta">{meta}</p> : null}
              </header>
            );
          }
          if (block.type === "headnote")
            return (
              <p key={i} className="book-headnote">
                {block.text}
              </p>
            );
          if (block.type === "group")
            return (
              <p key={i} className="book-group-name">
                {block.name}
              </p>
            );
          if (block.type === "ingredients-heading")
            return (
              <h3 key={i} className="book-subheading">
                Ingredients
              </h3>
            );
          if (block.type === "ingredients")
            return (
              <ul key={i} className="book-ingredients">
                {block.items.map((item: string, j: number) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          if (block.type === "steps-heading")
            return (
              <h3 key={i} className="book-subheading">
                Method
              </h3>
            );
          if (block.type === "step")
            return (
              <p key={i} className="book-step">
                <span className="book-step-n">{block.n}</span>
                {block.text}
              </p>
            );
          return <div key={i} className="book-spacer" />;
        })}
      </div>
    </div>
  );
}

function Index({ page }: { page: any }) {
  return (
    <div className="book-body">
      <h2 className="book-heading">Index{page.part > 1 ? ` · ${page.part}` : ""}</h2>
      <ol className="book-index">
        {(page.entries ?? []).map((entry: any, i: number) => (
          <li key={i}>
            <span className="book-toc-title">{entry.name}</span>
            <span className="book-toc-dots" aria-hidden="true" />
            <span className="book-toc-page">{entry.pages.join(", ")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Notes() {
  return (
    <div className="book-body">
      <h2 className="book-heading">Notes</h2>
      <div className="book-rules" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
    </div>
  );
}

function Colophon({ page }: { page: any }) {
  return (
    <div className="book-centered">
      <p className="book-kicker">The end</p>
      <h2 className="book-colophon-title">{page.title}</h2>
      <p className="book-colophon-line">
        {page.recipeCount} {page.recipeCount === 1 ? "recipe" : "recipes"} · {page.pageCount}{" "}
        {page.pageCount === 1 ? "page" : "pages"}
      </p>
      <p className="book-colophon-brand">Made with OvenLovin</p>
    </div>
  );
}
