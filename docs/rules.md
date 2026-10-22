---
layout: default
title: Allergy & Dietary Rules
---

# Allergy & Dietary Rules

> **Safety-critical per-person dietary restriction and allergen checking**

OvenLovin provides comprehensive support for managing household dietary restrictions, food allergies, and preferences. Every household member can have custom rules that are checked against recipes, meal plans, and shopping lists.

## Overview

### Why Per-Person Rules?

Families have diverse dietary needs:

- **Parent A** might have a severe peanut allergy (block)
- **Child B** might be vegetarian (block animal products)
- **Parent C** might prefer to avoid gluten (prefer_avoid)
- **Child D** might need low-sodium meals (warn)

OvenLovin allows each person to have their own rules with different severity levels, ensuring safe and appropriate meal planning for everyone.

## Rule Severity Levels

Every rule has a severity that determines how it's handled:

### Block (Hard Restriction)

**Use for**: Life-threatening allergies, strict dietary requirements

**Behavior**:
- Recipe is flagged as **unsafe** for this person
- Meal plans including this recipe show a **block** finding
- Shopping lists mark ingredients with **block** warnings
- Affected person is named in all warnings

**Example**:
```json
{
  "personId": "6f1c2a90-8d3e-4b7a-9c12-0e4f5a6b7c8d",
  "personName": "Parent A",
  "kind": "allergen",
  "target": "peanut",
  "severity": "block"
}
```

**Result**: Any recipe containing peanuts will be blocked for Parent A.

### Warn (Review Required)

**Use for**: Possible cross-contamination, foods that need careful preparation, moderate restrictions

**Behavior**:
- Recipe is flagged for **review**
- Meal plans show a **warn** finding
- Shopping lists mark ingredients with **warn** warnings
- Suggests extra caution or preparation steps

**Example**:
```json
{
  "personId": "8a3d4e5f-1b2c-4d6e-8f90-1a2b3c4d5e6f",
  "personName": "Child B",
  "kind": "allergen",
  "target": "dairy",
  "severity": "warn"
}
```

**Result**: Recipes with dairy trigger a warning for Child B.

### Prefer-Avoid (Preference)

**Use for**: Dietary preferences, foods to minimize, non-critical restrictions

**Behavior**:
- Recipe is flagged as **not preferred**
- Meal plans show a **prefer_avoid** finding
- Shopping lists mark ingredients with **prefer_avoid** notes
- Bot suggests alternatives when available

**Example**:
```json
{
  "personId": "9b4e5f60-2c3d-4e7f-9012-2b3c4d5e6f70",
  "personName": "Parent C",
  "kind": "ingredient",
  "target": "gluten",
  "severity": "prefer_avoid"
}
```

**Result**: Recipes with gluten are noted for Parent C, but not blocked.

## Rule Types

### Allergen Rules

**Target**: Common food allergens

**Supported allergens**:
- Peanuts
- Tree nuts (almonds, cashews, walnuts, pecans, pistachios, macadamias, hazelnuts, Brazil nuts)
- Coconut (separate from tree nuts; see below)
- Dairy (milk, cheese, butter, cream, yogurt)
- Eggs
- Fish (salmon, tuna, cod, halibut)
- Shellfish (shrimp, crab, lobster, clams, mussels, oysters)
- Wheat
- Soy
- Sesame

**Example**:
```json
{
  "kind": "allergen",
  "target": "tree_nuts",
  "severity": "block",
  "notes": "Severe allergy - includes all tree nuts and nut oils"
}
```

**Coconut is not a tree nut by default.** FDA historically listed coconut as a tree nut, but most families who block tree nuts still eat coconut milk, oil, and flakes. A `tree_nut` rule stores `treatCoconutAsTreeNut` (boolean, **default `false`**). Turn it on per person in the People UI, REST, or `manage_person_rules` if that person also avoids coconut. Coconut itself is a separate allergen (`target: "coconut"`).

**Matching**:
- Exact matches: "peanuts", "peanut butter", "peanut oil"
- Aliases: "groundnuts" (peanuts), "cow's milk" (dairy)
- Hidden ingredients: "albumin" (eggs), "casein" (dairy)
- Cross-contamination warnings: "may contain nuts"

### Ingredient Rules

**Target**: Specific ingredients to restrict

**Use cases**:
- Nightshades (tomatoes, peppers, eggplant, potatoes)
- Onions and garlic
- Citrus fruits
- Spicy foods
- Any specific food

**Example**:
```json
{
  "kind": "ingredient",
  "target": "garlic",
  "severity": "block",
  "notes": "Cannot digest garlic or garlic powder"
}
```

**Matching**:
- Ingredient name: "garlic", "garlic powder", "garlic salt"
- Compound ingredients: "garlic butter", "garlic bread"
- Related forms: fresh, dried, powdered, oil, extract

### Dietary Rules

**Target**: Dietary patterns and lifestyles

**Supported diets**:
- Vegetarian (no meat, fish, or poultry)
- Vegan (no animal products)
- Pescatarian (no meat or poultry, fish allowed)
- Gluten-free
- Dairy-free
- Kosher
- Halal
- Paleo
- Keto
- Low-carb

**Example**:
```json
{
  "kind": "dietary",
  "target": "vegetarian",
  "severity": "block",
  "notes": "Strict vegetarian - no meat, fish, or poultry"
}
```

**Matching**:
- For vegetarian: blocks beef, chicken, pork, fish, seafood, gelatin, anchovies (in sauces)
- For vegan: blocks all animal products including dairy, eggs, honey
- For gluten-free: blocks wheat, barley, rye, and cross-contaminated oats

### Nutrition Rules

**Target**: Nutritional constraints and limits

**Use cases**:
- Low-sodium (heart health)
- Low-sugar (diabetes management)
- Low-carb (weight management)
- High-protein (fitness goals)
- Calorie limits

**Example**:
```json
{
  "kind": "nutrition",
  "target": "sodium",
  "threshold": {
    "max": 600,
    "unit": "mg"
  },
  "severity": "warn",
  "notes": "Reduce sodium for blood pressure management"
}
```

**Matching**:
- Compares recipe nutrition data against threshold
- Per-serving calculations
- Warns when threshold is exceeded
- Suggests low-sodium alternatives

## Safety Guarantees

OvenLovin implements these safety invariants:

### 1. Deterministic Checking

✅ **Guarantee**: Same inputs (recipe, attendees, rules) always produce the same findings

**Why**: Families must be able to trust that allergen checking is consistent and reliable.

**Implementation**:
- Rule matching uses canonical ingredient taxonomy
- Severity levels are well-defined
- Check results are stored with content hash

### 2. Always Name Affected Person

✅ **Guarantee**: Every warning includes the person's name, the ingredient, and the rule

**Why**: Families need to know exactly who is affected and why.

**Example output**:
```json
{
  "personId": "6f1c2a90-8d3e-4b7a-9c12-0e4f5a6b7c8d",
  "personName": "Parent A",
  "severity": "block",
  "ingredientName": "peanut butter",
  "ruleName": "Peanut allergy",
  "message": "Parent A: recipe contains peanut butter (block rule: Peanut allergy)"
}
```

### 3. Incomplete Checks Are Reported

✅ **Guarantee**: When checking cannot complete, status is `incomplete` with reasons

**Why**: "No issues" must mean the check actually ran, not that it failed silently.

**Example**:
```json
{
  "status": "incomplete",
  "reasons": [
    "Recipe missing ingredient list",
    "Parent A's rules not loaded"
  ],
  "findings": {
    "block": [],
    "warn": [],
    "prefer_avoid": []
  }
}
```

### 4. Recipe Changes Trigger Recheck

✅ **Guarantee**: Editing a recipe or changing a person's rules marks affected meal plans as `needs_recheck`

**Why**: Stale checks could miss newly added allergens or rule changes.

**Implementation**:
- Recipe edits increment `version` and set dependent plans to `needs_recheck: true`
- Rule edits mark all plans with that person as attendee to `needs_recheck: true`
- Bots are prompted to re-run checks before finalizing plans

### 5. No Hard-Coded Policies

✅ **Guarantee**: All allergen and dietary policies are per-person configuration

**Why**: Every family's needs are different - no assumptions should be baked into the code.

**Implementation**:
- No default "always block peanuts" logic
- No hidden "vegetarian = no eggs" assumptions
- All rules are explicit, user-configured, and visible

## Configuring Rules

### Via Web UI

The person page has three lists. Each is tap-to-add - pick a catalog suggestion or type a custom term and tap **Use ‘…’**.

1. **Can't eat** - stored as `severity: block`. Allergens stay `kind: allergen` (shared-facility Yes / Ask me / No is unchanged). Diets stay `kind: diet`. Custom terms stay `kind: ingredient`.
2. **Doesn't like** - stored as `severity: prefer_avoid`.
3. **Loves** - positive preferences. They never filter recipes; they boost ranking and show “{Name} loves this”.

The retired “Doesn't eat” diet bucket now maps to **Can't eat**. Existing diet+block rows are unchanged in the database.

### Via API

All ids are UUIDs.

**Create a rule**:

```bash
POST /api/v1/people/{personId}/rules

{
  "kind": "allergen",
  "target": "peanut",
  "severity": "block",
  "note": "Severe peanut allergy - EpiPen required"
}
```

**Response**:
```json
{
  "id": "3e9a2b7c-6d5f-4b02-8d1e-4f0a9c8b7d6e",
  "personId": "6f1c2a90-8d3e-4b7a-9c12-0e4f5a6b7c8d",
  "kind": "allergen",
  "target": "peanut",
  "severity": "block",
  "note": "Severe peanut allergy - EpiPen required",
  "createdAt": "2026-10-12T21:00:00Z",
  "updatedAt": "2026-10-12T21:00:00Z"
}
```

### Via MCP Tools

**Using Claude, ChatGPT, or Grok**:

```
User: "Add a peanut allergy rule for Parent A with severity block"

Bot: [Calls add_person_rule MCP tool]

Bot: "I've added a block rule for peanuts to Parent A's profile. 
Any recipes containing peanuts will now be flagged as unsafe for Parent A."
```

## Checking Recipes

### Check a Single Recipe

Use `GET /api/v1/recipes?forAttendees=PERSON_ID,PERSON_ID` (recipes that hit a block rule move to `hidden`), or put the recipe on a plan and call `GET /api/v1/meal-plans/{planId}/check`.

### Check a Meal Plan

**API**:
```bash
POST /api/v1/meal-plans/{planId}/check
```

Findings are `byEntry` and `byPerson`. If `status` is `incomplete`, do not treat the plan as safe. POST saves the report; GET only reads.

### Via Bots

**Using an MCP-connected bot**:

```
User: "Is the Chicken Pad Thai recipe safe for everyone in my household?"

Bot: [Calls get_household_context to get attendees and rules]
Bot: [Calls check_recipe with recipe ID and attendees]

Bot: "The Chicken Pad Thai recipe has the following findings:

⚠️ **Block** (unsafe):
- Parent A: contains peanuts and peanut oil (severe peanut allergy)

✅ **Safe for**:
- Child B (vegetarian rule not triggered - chicken is optional in notes)
- Parent C (no gluten found)
- Child D (sodium 450mg, within 600mg limit)

**Recommendation**: This recipe is not safe for Parent A. Would you like me to 
find a peanut-free Pad Thai recipe, or suggest a substitution?"
```

## Shopping Lists with Warnings

When generating shopping lists, OvenLovin marks ingredients that trigger rules:

**Example shopping list**:

```
📝 Shopping List - Week of Oct 13, 2026

🥬 Produce
  • 2 lbs chicken breast
  • 1 lb broccoli
  • 3 bell peppers
  • 1 head garlic
  • 1 bunch cilantro

🥫 Pantry
  • 1 jar soy sauce
  • ⚠️ 1 jar peanut butter [⚠️ Block: Parent A - peanut allergy]
  • 1 package rice noodles

🧀 Dairy
  • 1 gallon milk
  • 8 oz cheddar cheese
  • ⚠️ 1 stick butter [⚠️ Prefer-avoid: Child B - vegan]

🍞 Bakery
  • ⚠️ 1 loaf wheat bread [⚠️ Prefer-avoid: Parent C - gluten-free]
```

**Via API**:

```bash
GET /api/v1/meal-plans/{planId}/shopping-list
```

JSON is a `ShoppingListData` object. Section items use `key`, `name`, `quantity` (number), `unit`, `displayQuantity`, `displayUnit`, `aisle`, `recipes[]`, `checked`. Warnings are listed once in top-level `warnings`, not on each item.

## Best Practices

### For Families

1. **Be explicit**: Add rules for every restriction, even "obvious" ones
2. **Use appropriate severity**: Reserve `block` for true hard restrictions
3. **Add notes**: Include context like "EpiPen required" or "vegetarian by choice"
4. **Review regularly**: Update rules as dietary needs change
5. **Check before shopping**: Always review warnings on shopping lists

### For Bots

1. **Always get household context first**: Use `get_household_context` before recipe operations
2. **Run checks before finalizing**: Never suggest a meal plan without checking
3. **Explain findings clearly**: Name the person, ingredient, and severity
4. **Suggest alternatives**: When a recipe is blocked, offer substitutions
5. **Respect incomplete checks**: If status is `incomplete`, tell the user and suggest fixes

### For Developers

1. **Never hard-code policies**: All rules must be user-configured
2. **Always name affected person**: Include `personId` and `personName` in findings
3. **Use deterministic matching**: Same inputs → same outputs
4. **Report incomplete checks**: Never return "no issues" when checking failed
5. **Mark plans for recheck**: Recipe/rule edits must trigger `needs_recheck`

## Troubleshooting

### False Positives

**Problem**: Recipe flagged but doesn't contain the allergen

**Solutions**:
- Check ingredient aliases in allergen taxonomy
- Review recipe ingredient list for hidden ingredients
- Update taxonomy if legitimate false positive

### False Negatives

**Problem**: Recipe should be flagged but isn't

**Solutions**:
- Verify rule is configured correctly
- Check ingredient name matches taxonomy
- Add aliases to allergen taxonomy if needed
- Report issue if it's a taxonomy gap

### Incomplete Checks

**Problem**: Check returns `status: incomplete`

**Solutions**:
- Ensure recipe has complete ingredient list
- Verify all attendees have loaded rules
- Check recipe version is current
- Re-import recipe if ingredient extraction failed

## Resources

- **[Bot Setup Guide](bot-setup.md)** - Configure bots to use rule checking
- **[API Reference](https://tbarho.github.io/ovenlovin/docs/reference/api)** - REST endpoints for rules and checking
- **[GitHub Issues](https://github.com/tbarho/ovenlovin/issues)** - Report taxonomy gaps or bugs

---

Built with ❤️ for safe, AI-powered family meal planning
