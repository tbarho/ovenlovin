import { describe, expect, it } from "vitest";
import { pageTextFromHtml } from "./page-text";

describe("pageTextFromHtml", () => {
  it("keeps title, headings, and list items and drops scripts", () => {
    const text = pageTextFromHtml(`<html><head>
      <title>Weeknight Tomato Pasta</title>
      <script>window.ad = true</script>
    </head><body>
      <nav>Home</nav>
      <h1>Weeknight Tomato Pasta</h1>
      <h2>Ingredients</h2>
      <ul><li>12 oz pasta</li><li>1 can tomatoes</li></ul>
      <h2>Instructions</h2>
      <ol><li>Boil the pasta.</li></ol>
    </body></html>`);
    expect(text).toMatch(/Weeknight Tomato Pasta/);
    expect(text).toMatch(/12 oz pasta/);
    expect(text).toMatch(/Boil the pasta/);
    expect(text).not.toMatch(/window\.ad/);
  });

  it("keeps table cell text when there is no ingredient list", () => {
    const text = pageTextFromHtml(`<html><body>
      <main>
        <h2>Ingredients</h2>
        <table>
          <tr><td>White sugar</td><td>1 cup</td></tr>
          <tr><td>Butter, softened</td><td>1/2 cup</td></tr>
        </table>
      </main>
    </body></html>`);
    expect(text).toMatch(/White sugar/);
    expect(text).toMatch(/Butter/);
  });

  it("skips tables when the page already has an ingredient list", () => {
    const text = pageTextFromHtml(`<html><body>
      <main>
        <h2>Ingredients</h2>
        <ul><li>12 oz pasta</li><li>1 can tomatoes</li></ul>
        <table><tr><td>Calories</td><td>400</td></tr></table>
      </main>
    </body></html>`);
    expect(text).toMatch(/12 oz pasta/);
    expect(text).not.toMatch(/Calories/);
  });

  it("does not re-add table text that is already in a paragraph", () => {
    const text = pageTextFromHtml(`<html><body>
      <main>
        <h2>Ingredients</h2>
        <p>White sugar 1 cup</p>
        <table><tr><td>White sugar 1 cup</td></tr></table>
      </main>
    </body></html>`);
    expect(text.match(/White sugar 1 cup/g)).toHaveLength(1);
  });

  it("caps long pages", () => {
    const long = `<html><body><p>${"pasta ".repeat(8000)}</p></body></html>`;
    expect(pageTextFromHtml(long).length).toBeLessThanOrEqual(12_000);
  });
});
