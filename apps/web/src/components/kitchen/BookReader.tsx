"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ReaderBook } from "@/lib/book-reader";
import { BookPage } from "./BookPage";

const FlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

/** A portrait page is taller than wide, like a real book page. */
export const PAGE_RATIO = 1.35;
/** At this width or below the book shows one page at a time. */
export const SINGLE_MAX = 375;

export type BookSize = { w: number; h: number; single: boolean };

/**
 * Page size that fits the stage. Pure, so tests can drive the breakpoints.
 * Rounded to whole 4px steps so small resizes do not rebuild the flipbook.
 */
export function fitBook(stageW: number, stageH: number): BookSize | null {
  if (stageW < 200 || stageH < 260) return null;
  const single = stageW <= SINGLE_MAX;
  const maxH = Math.min(stageH - 16, 760);
  let w = single ? Math.min(stageW - 16, 400) : Math.min((stageW - 32) / 2, 420);
  let h = w * PAGE_RATIO;
  if (h > maxH) {
    h = maxH;
    w = h / PAGE_RATIO;
  }
  const snap = (value: number) => Math.max(120, Math.round(value / 4) * 4);
  return { single, w: snap(w), h: snap(h) };
}

/** The pages currently shown: one in portrait, the open spread in landscape. */
export function spreadOf(page: number, total: number, single: boolean): number[] {
  if (single) return [Math.min(page, total - 1)];
  if (page <= 0) return [0];
  if (page >= total - 1) return [total - 1];
  return [page, page + 1];
}

export function BookReader({ book }: { book: ReaderBook }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<any>(null);
  const [size, setSize] = useState<BookSize | null>(null);
  const [page, setPage] = useState(0);
  const total = book.pages.length;

  useEffect(() => {
    const measure = () => {
      const stage = stageRef.current;
      if (!stage) return;
      setSize(fitBook(stage.clientWidth, stage.clientHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const flip = (direction: 1 | -1) => {
    const engine = flipRef.current?.pageFlip();
    if (!engine) return;
    if (direction === 1) engine.flipNext();
    else engine.flipPrev();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]"))
        return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        flip(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        flip(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (total === 0) {
    return (
      <div className="book-reader">
        <div className="book-reader-head">
          <Link href={`/recipes?cookbook=${book.id}`} className="back-link">
            ← {book.title}
          </Link>
        </div>
        <div className="empty-card book-reader-empty">
          <p>This book has no recipes yet.</p>
          <Link className="btn primary" href={`/recipes?cookbook=${book.id}`}>
            Add recipes
          </Link>
        </div>
      </div>
    );
  }

  const shown = spreadOf(page, total, size?.single ?? false);
  const first = shown[0] ?? 0;
  const last = shown[shown.length - 1] ?? 0;
  const hasPrev = first > 0;
  const hasNext = last < total - 1;
  const label = shown.map((n) => book.pages[n]!.number).join("–");

  return (
    <div className="book-reader">
      <div className="book-reader-head">
        <Link href={`/recipes?cookbook=${book.id}`} className="back-link">
          ← {book.title}
        </Link>
      </div>

      <div className="book-reader-stage" ref={stageRef}>
        {size ? (
          <>
            {/* react-pageflip's typings mark every setting required; runtime has defaults. */}
            <FlipBook
              key={`${size.single}-${size.w}x${size.h}`}
              {...({
                ref: flipRef,
                className: "book-flip",
                width: size.w,
                height: size.h,
                size: "fixed",
                autoSize: false,
                showCover: true,
                usePortrait: true,
                startPage: page,
                maxShadowOpacity: 0.5,
                flippingTime: 650,
                startZIndex: 1,
                onFlip: (event: any) => setPage(event.data),
              } as any)}
            >
              {book.pages.map((pageData: any, i: number) => (
                <BookPage key={i} page={pageData} size={size} bookId={book.id} />
              ))}
            </FlipBook>
            <button
              type="button"
              className="book-arrow book-arrow-prev"
              aria-label="Previous page"
              disabled={!hasPrev}
              onClick={() => flip(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="book-arrow book-arrow-next"
              aria-label="Next page"
              disabled={!hasNext}
              onClick={() => flip(1)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      <div className="book-reader-foot">
        <p aria-live="polite">
          Page {label} <span className="book-reader-total">of {total}</span>
        </p>
      </div>
    </div>
  );
}
