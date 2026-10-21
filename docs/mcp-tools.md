# MCP Tools

Remote MCP server: `https://your-app.vercel.app/mcp`

## Auth

Send `Authorization: ApiKey rkapi_...` or `Bearer` with the same key or a Clerk JWT. Clerk users must already have an OvenLovin kitchen (open the app in the browser once; MCP does not create one). On MCP with a Clerk JWT, optional `X-Kitchen-Id` selects a kitchen you belong to. An API key is bound to one kitchen; a mismatched `X-Kitchen-Id` is rejected.

## Recipes

- `whoami` - authenticated household, scopes, and key identity
- `search_recipes` - search by text, method tags, and attendee warnings. `forAttendees` hides block hits and returns `hiddenCount` / `hidden` (recipe, person, ingredient, why). `images` is a thumbnail URL only (never inline `data:` bytes)
- `get_recipe` - full recipe including servings (stored yield), `displayServings` (kitchen Default servings), `scaledNote`, prep/cook times, images, cookbooks, and source URL (`includeSource` defaults to true). Same thumbnail-URL rule for `images`. `ingredients.displayText` is the cooking-fraction line at `displayServings`; `rawText` is the stored import string.
- `create_recipe` - create from title, ingredients, and steps (no URL). Prefer `import_recipe` when a public URL exists
- `import_recipe` - URL or paste. Inputs: `source` (required), `content` (or `draft`), `save` (`false` previews; omit to persist), `idempotencyKey`, `allowDuplicate`, `skipReview` (clears `needsReview`), `cookbookId`. Pulls schema.org times and the main image into Vercel Blob. Duplicate URL/draft returns `duplicate:true`. Classified import failures are JSON-RPC `-32602`; `import_ai_unavailable` is `-32603`.
- `import_recipe_from_image` - photo. Inputs: `imageUrl` / `imageBase64` / `images[]` / `draft`, plus `save`, `idempotencyKey`, `allowDuplicate`, `skipReview`, `cookbookId`. First photo is the main image. Returns `uncertainFields` when the photo is hard to read.
- `delete_recipe` - soft-delete a recipe. Does not delete cookbooks.

## Cookbooks

Cookbooks are many-to-many folders over recipes. One recipe can appear in several cookbooks.

- `list_cookbooks` - household cookbooks with recipe counts and preview images
- `get_cookbook` - cookbook plus its recipes
- `manage_cookbook` - `create`, `rename`, `delete`, `add_recipe`, `remove_recipe`

## Household and plans

- `get_household_context` - people in household `sortOrder`, Default servings (`servingsSettings`: family / fixed / recipe), plus per-person Loves (never used to hide recipes)
- `manage_household_schedule` - get or replace weekly availability and busy-night dinner budgets
- `manage_household_settings` - get or update kitchen Default servings (`family` = max(recipe yield, People count), `fixed` = a number 1-99, `recipe` = stored yield)
- `manage_kitchen_invites` - create, list, or revoke shareable kitchen invite links (owner or admin; default role member)
- `manage_kitchen_members` - list signed-in kitchen members, change roles, remove a member, or leave
- `get_person_rules` - Can't eat / Doesn't like rules plus Loves
- `manage_people` - list, create, update, or delete people
- `manage_person_rules` - list / add / remove rules. Dislikes spicy: `kind=ingredient` or `tag`, `target=spicy`, `severity=prefer_avoid` (matches cayenne, chiles, chili powder, hot sauce, and similar heat). Other taste dislikes: cilantro, olives, mushrooms, onions, garlic. Unknown targets need `confirmUnknown=true`. Tree-nut rules accept `treatCoconutAsTreeNut` (default `false`; coconut is not a tree nut unless set)
- `reorder_people` - persist household people order (`personIds` must list everyone once)
- `manage_person_loves` - `list`, `add`, `remove` a food, cuisine, or style someone loves
- `search_recipes` - attendee warnings plus love boosts and “Name loves this” tags
- `save_meal_plan` - requires `weekStart`, `entries`, and `checkReportJson` from `check_meal_plan`. Nights require `date`, `meal`, `attendees`. `recipeId` and `servings` are optional; use `freeformMeal` for leftovers / no-cook
- `get_meal_plan` - `planId` or `weekStart`. Recipe nights plus `freeformMeal` / servings for leftovers or no-cook
- `edit_meal_plan` - `set`, `swap`, or `clear` a single night (or `undo` the last entries edit). `set`/`swap` need `recipeId` or `freeformMeal`
- `delete_meal_plan` - soft-delete a meal plan
- `check_meal_plan` - `plan.weekStart` + `plan.entries` (`date`, `meal`, `attendees`; optional `recipeId` / `freeformMeal` / `servings`). Per-person findings plus informational `loveTags` (never a filter)
- `export_shopping_list` - `planId` required. `format` default `markdown`; `groupBy` default `aisle`. Optional `includeStaples` (alias `includePantryItems`), `includeRuleWarnings` (default true), `timeZone`. Amounts follow the week cook-for; per-night servings do not change list amounts.
