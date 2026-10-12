# @ovenlovin/allergens

Allergen taxonomy and per-person rule checker for OvenLovin.

## Overview

This package provides:

- **Allergen taxonomy**: Tree structure covering US Big 9, EU 14, and custom allergens
- **Ingredient mapping**: Deterministic matching of ingredients to allergens (with aliases, misspellings, OCR variants)
- **Rule checker**: Per-person checking with configurable severities (block/warn/prefer-avoid)
- **Meal plan checker**: `check_meal_plan` function for full plan validation
- **Adversarial test suite**: Hidden nuts, misspellings, OCR errors, plurals, aliases, may-contain labels
- **Property tests**: fast-check invariants for rule matching

## Key Features

### Taxonomy

- **Peanut** and **tree nuts** thoroughly covered (almond, cashew, pecan, walnut, pistachio, hazelnut, macadamia, brazil nut, pine nut, etc.)
- **Coconut** is separate and configurable per person via `treatCoconutAsTreeNut` rule option
- Hierarchical structure: checking `tree_nut` with `includeDescendants=true` covers all tree nut species

### Per-person Rules

Rules are configured by the family admin with:

- `severity`: `block` | `warn` | `prefer_avoid`
- `sharedFacility`: `block` | `warn` | `ignore` (for "may contain" labels)
- `includeMayContain`: bool
- `includeCrossContact`: bool
- `includeUnmappedIngredients`: bool (how to handle ingredients with no mapping)
- `includeDescendants`: bool (check all children in taxonomy)
- `treatCoconutAsTreeNut`: bool (for tree nut rules)

### Safety Principles

- **Deterministic**: same inputs → same outputs
- **Nothing hard-coded to fail closed**: all rules are per-person config
- **Transparent warnings**: name the person, rule, ingredient, and reason
- **Incomplete = reported**: `status: incomplete` if checking cannot complete, never "no issues"

## Usage

```typescript
import { allergenTaxonomy, buildAllergenMap, getDescendants } from "@ovenlovin/allergens";

// Get all tree nut descendants
const treeNuts = getDescendants("tree_nut");
// => ["almond", "cashew", "walnut", "black_walnut", ...]

// Build flat lookup map
const map = buildAllergenMap();
const almond = map.get("almond");
// => { name: "Almond", parent: "tree_nut" }
```

## Testing

```bash
pnpm test           # Run tests
pnpm test:watch     # Watch mode
pnpm typecheck      # Type checking
pnpm lint           # Linting
```

## Status

🚧 Under active development

## Related

- Issue: [#1](https://github.com/tbarho/ovenlovin/issues/1)
- Package: `@ovenlovin/core` (schemas)
- Package: `@ovenlovin/db` (database schema)
