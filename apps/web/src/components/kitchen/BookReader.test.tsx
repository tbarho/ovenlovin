import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReaderBook } from "@/lib/book-reader";
import { fitBook, spreadOf, BookReader } from "./BookReader";

const mock = vi.hoisted(() => ({ current: 0, props: null as any }));

vi.mock("react-pageflip", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef(function FlipStub(props: any, ref: any) {
      mock.props = props;
      React.useImperativeHandle(ref, () => ({
        // Spread starts like the real engine with showCover: 0, then 1, 3, 5...
        pageFlip: () => ({
          flipPrev: () => {
            if (mock.current <= 0) return;
            mock.current = mock.current === 1 ? 0 : mock.current - 2;
            props.onFlip?.({ data: mock.current });
          },
          flipNext: () => {
            const total = React.Children.count(props.children);
            const next = mock.current === 0 ? 1 : mock.current + 2;
            if (next >= total) return;
            mock.current = next;
            props.onFlip?.({ data: mock.current });
          },
        }),
      }));
      return <div data-testid="flipbook">{props.children}</div>;
    }),
  };
});

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<any>) => {
      const Component = React.lazy(async () => {
        const loaded = await loader();
        return { default: loaded.default ?? loaded };
      });
      return function Dynamic(props: any) {
        return (
          <React.Suspense fallback={null}>
            <Component {...props} />
          </React.Suspense>
        );
      };
    },
  };
});

const HERO = "https://store.public.blob.vercel-storage.com/recipes/h/lemon.png";

function bookFixture(): ReaderBook {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    title: "Test book",
    subtitle: null,
    pages: [
      { number: 1, kind: "cover", title: "Test book", subtitle: null, image: null },
      { number: 2, kind: "photo", recipeId: "r1", title: "Lemon soup", image: HERO },
      {
        number: 3,
        kind: "recipe",
        recipeId: "r1",
        title: "Lemon soup",
        blocks: [
          {
            type: "header",
            title: "Lemon soup",
            servings: 4,
            yieldQuantity: null,
            yieldUnit: null,
            prepTimeMinutes: 10,
            cookTimeMinutes: 20,
            totalTimeMinutes: 30,
          },
          { type: "ingredients-heading" },
          { type: "ingredients", items: ["1 cup flour", "2 lemons"] },
        ],
      },
      { number: 4, kind: "colophon", title: "Test book", recipeCount: 1, pageCount: 4 },
    ],
  };
}

function setStageSize(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => height,
  });
}

describe("fitBook", () => {
  it("shows a single page at 375px and under", () => {
    expect(fitBook(375, 700)?.single).toBe(true);
    expect(fitBook(320, 700)?.single).toBe(true);
    expect(fitBook(376, 700)?.single).toBe(false);
  });

  it("keeps the portrait ratio whatever the stage", () => {
    const size = fitBook(900, 700);
    expect(size).not.toBeNull();
    expect(size!.h / size!.w).toBeCloseTo(1.35, 1);
  });

  it("waits for a stage big enough to read", () => {
    expect(fitBook(150, 200)).toBeNull();
  });
});

describe("spreadOf", () => {
  it("shows the cover alone, then pairs", () => {
    expect(spreadOf(0, 6, false)).toEqual([0]);
    expect(spreadOf(1, 6, false)).toEqual([1, 2]);
    expect(spreadOf(5, 6, false)).toEqual([5]);
  });

  it("shows one page at a time in portrait", () => {
    expect(spreadOf(2, 6, true)).toEqual([2]);
  });
});

describe("BookReader", () => {
  beforeEach(() => {
    mock.current = 0;
    mock.props = null;
    setStageSize(900, 700);
  });

  it("renders the cover first with the page indicator and edge arrows", async () => {
    render(<BookReader book={bookFixture()} />);
    const flip = await screen.findByTestId("flipbook");
    expect(within(flip).getByText("The family book")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(screen.getByText("Page 1")).toBeVisible();
    expect(screen.getByText("of 4")).toBeVisible();
  });

  it("flips forward and back from the edge arrows and updates the indicator", async () => {
    const user = userEvent.setup();
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2-3")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Page 1")).toBeVisible();
    expect(screen.getByText("of 4")).toBeVisible();
  });

  it("turns pages with the arrow keys", async () => {
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(await screen.findByText("Page 2-3")).toBeVisible();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(await screen.findByText("Page 1")).toBeVisible();
  });

  it("shows one page at a time on a narrow stage and keeps the current page", async () => {
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(await screen.findByText("Page 2-3")).toBeVisible();

    setStageSize(360, 700);
    window.dispatchEvent(new Event("resize"));
    expect(await screen.findByText("Page 2")).toBeVisible();
    expect(screen.queryByText(/Page 2-3/)).toBeNull();
  });

  it("puts the photo caption below the photo, never on top of it", async () => {
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");
    const photo = screen.getByAltText("Lemon soup");
    const caption = screen.getByRole("link", { name: "Lemon soup" });
    expect(photo.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(caption.closest(".book-photo-caption")).not.toBeNull();
    expect(photo.closest(".book-photo-caption")).toBeNull();
    expect(screen.getByText("p. 2")).toBeVisible();
  });

  it("keeps the last page reachable and the arrows honest at the end", async () => {
    const user = userEvent.setup();
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 4")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeEnabled();
  });

  it("shows the recipe page with its meta line", async () => {
    const user = userEvent.setup();
    render(<BookReader book={bookFixture()} />);
    await screen.findByTestId("flipbook");
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Serves 4 · Prep 10 min · Cook 20 min · Total 30 min")).toBeVisible();
  });

  it("offers to add recipes when the book is empty", () => {
    render(
      <BookReader
        book={{
          id: "00000000-0000-4000-8000-000000000020",
          title: "Empty",
          subtitle: null,
          pages: [],
        }}
      />
    );
    expect(screen.getByText("This book has no recipes yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Add recipes" })).toHaveAttribute(
      "href",
      "/recipes?cookbook=00000000-0000-4000-8000-000000000020"
    );
  });

  it("links nowhere into the kitchen when shared", async () => {
    render(<BookReader book={bookFixture()} shared />);
    await screen.findByTestId("flipbook");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Lemon soup", { selector: ".book-photo-caption span" })).toBeVisible();
  });
});
