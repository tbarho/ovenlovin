# Import from your device

Some recipe sites block OvenLovin's server fetch. You can send the page from your own browser or phone instead. The server still runs the same extract path: JSON-LD, then HTML recipe cards, then the cheap LLM.

## Bookmarklet

On **Recipes** (the import card) or **Settings**, drag **Save to OvenLovin** onto your bookmarks bar, or tap **Copy bookmarklet** and paste it as a bookmark.

1. Stay signed in to OvenLovin in the same browser.
2. Open the recipe page.
3. Tap the bookmark.
4. OvenLovin saves the recipe and opens it.

The bookmarklet opens OvenLovin with the page's schema.org Recipe JSON-LD when it exists, or the page HTML if it does not. Stay signed in first (SameSite session cookies only travel on that navigation). OvenLovin then POSTs to the authenticated capture endpoint and opens the saved recipe.

## iOS Shortcut (share sheet)

Use this when you want to share a page from Safari with an API key.

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

The endpoint needs the page HTML or JSON-LD. When the site blocks OvenLovin's server fetch, include the page HTML from step 4.

## API

`POST /api/v1/recipes/import/page`

Authenticated with a Clerk session (bookmarklet form POST) or `Authorization: ApiKey rkapi_...`.

JSON body:

```json
{
  "url": "https://www.budgetbytes.com/beef-stroganoff/",
  "html": "<html>...optional if jsonLd is set...</html>",
  "jsonLd": { "@type": "Recipe", "name": "Beef Stroganoff" }
}
```

Form body (bookmarklet): `url`, plus `jsonLd` or `html`. A form POST redirects to `/recipes/{id}`. A JSON POST returns `201` and the recipe.
