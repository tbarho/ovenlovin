# MCP Tools

Remote MCP server: `https://your-app.vercel.app/mcp`

## Recipes

- `search_recipes` — search by text, method tags, and attendee warnings. `forAttendees` hides block hits and returns `hiddenCount` / `hidden` (recipe, person, ingredient, why). `images` is a thumbnail URL only (never inline `data:` bytes)
- `get_recipe` — full recipe including servings, prep/cook times, images, cookbooks, and source URL (`includeSource` defaults to true). Same thumbnail-URL rule for `images`
- `import_recipe` — URL or paste import. Pulls schema.org times and the main image, then copies that image into Vercel Blob. Optional `cookbookId`
- `import_recipe_from_image` — photo import from an `imageUrl` or `imageBase64` (optional extra `images[]` pages). Uses AI Gateway vision (`RK_MODEL_VISION`). Saves the first photo as the single main image (Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set; otherwise list/search expose `GET /api/v1/recipes/{id}/image`). Returns `uncertainFields` when the photo is hard to read.

## Cookbooks

Cookbooks are many-to-many folders over recipes. One recipe can appear in several cookbooks.

- `list_cookbooks` — household cookbooks with recipe counts and preview images
- `get_cookbook` — cookbook plus its recipes
- `manage_cookbook` — `create`, `rename`, `delete`, `add_recipe`, `remove_recipe`

## Household and plans

- `get_household_context` — people in household `sortOrder`, plus per-person Loves (never used to hide recipes)
- `get_person_rules` — Can't eat / Doesn't like rules plus Loves
- `manage_person_rules` — list / add / remove rules. Tree-nut rules accept `treatCoconutAsTreeNut` (default `false`; coconut is not a tree nut unless set)
- `reorder_people` — persist household people order (`personIds` must list everyone once)
- `manage_person_loves` — `list`, `add`, `remove` a food, cuisine, or style someone loves
- `search_recipes` — attendee warnings plus love boosts and “Name loves this” tags
- `save_meal_plan`
- `get_meal_plan` — recipe nights plus `freeformMeal` / servings for leftovers or no-cook
- `edit_meal_plan` — `set`, `swap`, or `clear` a single night (or `undo` the last entries edit) without rewriting the week
- `check_meal_plan` — per-person findings plus informational `loveTags` (never a filter). Freeform leftovers are not flagged as cooking on a no-cook night
- `export_shopping_list`
