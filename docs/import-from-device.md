# Import from your device

Some recipe sites will not let OvenLovin's server read the page. On Import, a blocked URL shows paste and photo. You can also send the page from Safari or a browser bookmark. The server still runs the same extract path: JSON-LD, then HTML recipe cards, then the cheap LLM.

## Save from Safari on iPhone

This setup is under Import, collapsed as **Save from Safari on iPhone**.

1. Open OvenLovin **Settings** and create an API key (or copy the demo key).
2. In the Shortcuts app, create a new shortcut.
3. Add **Receive URLs and Safari web pages** from the Share Sheet.
4. Add **Get Contents of Web Page** (or **Get Text from Input** if you already have HTML).
5. Add **Get URLs from Input** so you have the recipe URL.
6. Add **Get Contents of URL**:
   - URL: `https://YOUR-HOST/api/v1/recipes/import/page`
   - Method: POST
   - Headers: `Authorization` = `ApiKey YOUR_KEY` and `Content-Type` = `application/json`
   - Request body (JSON): `{ "url": Shared URL, "html": Web page text }`
7. Add **Get Dictionary from Input**.
8. Add **Open URLs** with `https://YOUR-HOST/recipes/` plus the `id` from the dictionary.

If `NEXT_PUBLIC_IOS_SHORTCUT_URL` is set, Import shows **Add the OvenLovin Shortcut**. When it is unset, use the steps above.

The endpoint needs the page HTML or JSON-LD.

## Advanced (browser bookmark)

Under Import, open **Advanced**. Drag **Save to OvenLovin** onto your bookmarks bar, or tap **Copy code** and paste it as a bookmark.

1. Stay signed in to OvenLovin in the same browser.
2. Open the recipe page.
3. Open the bookmark.
4. OvenLovin saves the recipe and opens it.

The bookmark sends schema.org Recipe JSON-LD when it exists, or the page HTML if it does not. Stay signed in first (SameSite session cookies only travel on that navigation). OvenLovin then POSTs to the authenticated capture endpoint.

## API

`POST /api/v1/recipes/import/page`

Authenticated with a Clerk session (capture page POST) or `Authorization: ApiKey rkapi_...`.

JSON body:

```json
{
  "url": "https://www.budgetbytes.com/beef-stroganoff/",
  "html": "<html>...optional if jsonLd is set...</html>",
  "jsonLd": { "@type": "Recipe", "name": "Beef Stroganoff" }
}
```

Form body: `url`, plus `jsonLd` or `html`. A form POST redirects to `/recipes/{id}`. A JSON POST returns `201` and the recipe.

`POST /api/v1/recipes/import/page` always persists (the client already captured the page to save it).

`POST /api/v1/recipes/import` and `POST /api/v1/recipes/import/photo` preview unless `save` is `true`. The web Import form and MCP tools send `save: true`. Send `Idempotency-Key` on persist so a dropped connection can be retried without a second recipe. Duplicate URL or photo imports return `409` with `recipeId`, `title`, and `recipeUrl`. Near-duplicate photos (a 1-pixel change) use the same warning. `needs_review` saves include `reviewReasons` and `uncertainFields`. Wikibooks titles drop the `Cookbook:` prefix.
