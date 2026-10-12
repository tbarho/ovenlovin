# @ovenlovin/cli

Command-line interface for OvenLovin.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Check a Meal Plan

```bash
export DATABASE_URL="postgresql://..."
ovenlovin check --plan-id <uuid>
ovenlovin check --plan-id <uuid> --verbose
```

### Import Recipes

```bash
# From URL
ovenlovin import --household-id <uuid> --user-id <uuid> url "https://example.com/recipe"

# From pasted text (stdin)
ovenlovin import --household-id <uuid> --user-id <uuid> paste

# From file
ovenlovin import --household-id <uuid> --user-id <uuid> paste --file recipe.txt
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (required)
