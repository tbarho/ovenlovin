# MCP Tools

Remote MCP server: `https://your-app.vercel.app/mcp`

## Recipes

- `search_recipes` — search by text, method tags, and attendee warnings
- `get_recipe` — full recipe including servings, prep/cook times, images, cookbooks, and source URL (`includeSource` defaults to true)
- `import_recipe` — URL or paste import. Pulls schema.org times and the main image, then copies that image into Vercel Blob. Optional `cookbookId`

## Cookbooks

Cookbooks are many-to-many folders over recipes. One recipe can appear in several cookbooks.

- `list_cookbooks` — household cookbooks with recipe counts and preview images
- `get_cookbook` — cookbook plus its recipes
- `manage_cookbook` — `create`, `rename`, `delete`, `add_recipe`, `remove_recipe`

## Household and plans

- `get_household_context`
- `get_person_rules`
- `save_meal_plan`
- `get_meal_plan`
- `check_meal_plan`
- `export_shopping_list`
