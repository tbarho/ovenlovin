import { fireEvent, render, screen, within } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

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
    version: "v1",
    name: "Test book",
    settings: {},
    recipes: [{ id: "r1", title: "Lemon soup", image: HERO }],
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
  it("shows a single page under a tablet's width", () => {
    expect(fitBook(320, 700)?.single).toBe(true);
    expect(fitBook(390, 700)?.single).toBe(true);
    expect(fitBook(767, 900)?.single).toBe(true);
    expect(fitBook(768, 900)?.single).toBe(false);
  });

  it("sizes the single page to the phone", () => {
    const size = fitBook(374, 640)!;
    // fitBook snaps to 4px, so allow one snap step past the raw margin.
    expect(size.w).toBeLessThanOrEqual(374 - 16 + 4);
    expect(size.h).toBeLessThanOrEqual(640 - 16 + 4);
    expect(size.single).toBe(true);
  });

  it("keeps page-flip in portrait when height caps a wide single stage", () => {
    // page-flip uses landscape when blockWidth >= pageWidth * 2. In single
    // mode the flip host is pinned to size.w, so 2*w must still beat a short
    // wide stage only after that pin - assert the sized page itself.
    const size = fitBook(700, 400)!;
    expect(size.single).toBe(true);
    expect(size.w * 2).toBeGreaterThan(size.w); // sanity
    expect(size.h).toBeLessThanOrEqual(400 - 16 + 4);
  });

  it("keeps the portrait ratio whatever the stage", () => {
    const size = fitBook(900, 700);
    expect(size).not.toBeNull();
    expect(size!.h / size!.w).toBeCloseTo(1.35, 1);
  });

  it("opens a desktop spread at reading size, not a thumbnail", () => {
    // 1440x900 window: the stage is about 1440x780 under the head and foot.
    const size = fitBook(1440, 780)!;
    expect(size.single).toBe(false);
    expect(size.w).toBeGreaterThanOrEqual(540);
    expect(size.h).toBeLessThanOrEqual(780 - 16 + 4);
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

  it("on a phone moves the arrows off the page and leaves the cover unnumbered", async () => {
    setStageSize(374, 640);
    const user = userEvent.setup();
    const { container } = render(<BookReader book={bookFixture()} />);
    const flip = await screen.findByTestId("flipbook");
    const foot = container.querySelector(".book-reader-foot") as HTMLElement;
    const stage = container.querySelector(".book-reader-stage") as HTMLElement;

    expect(within(foot).getByRole("button", { name: "Next page" })).toBeEnabled();
    expect(within(stage).queryByRole("button", { name: /page/ })).toBeNull();
    expect(flip.querySelector(".book-page--cover .book-page-number")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2")).toBeVisible();
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
          version: "v0",
          name: "Empty",
          settings: {},
          recipes: [],
        }}
      />
    );
    expect(screen.getByText("This book has no recipes yet.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Add recipes" })).toHaveAttribute(
      "href",
      "/recipes?cookbook=00000000-0000-4000-8000-000000000020"
    );
  });

  it("opens Make it yours from the header", async () => {
    render(<BookReader book={bookFixture()} />);
    fireEvent.click(screen.getByRole("button", { name: "Make it yours" }));
    expect(screen.getByRole("dialog", { name: "Make it yours" })).toBeVisible();
    expect(screen.getByLabelText("Dedication")).toHaveAttribute(
      "placeholder",
      "For Mom, Christmas 2026"
    );
  });

  it("links nowhere into the kitchen when shared", async () => {
    render(<BookReader book={bookFixture()} shared />);
    await screen.findByTestId("flipbook");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Make it yours" })).toBeNull();
    expect(screen.getByText("Lemon soup", { selector: ".book-photo-caption span" })).toBeVisible();
  });
});
