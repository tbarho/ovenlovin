# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each `## YYYY-MM-DD - Title` block is one ship day (UTC merge date on `main`). `apps/web` renders this file at `/changelog`, so write it for the people and agents who cook with OvenLovin: only changes they would notice and care about.

## [Unreleased]

Nothing yet. Everything below is on `main`.

## 2026-10-22 - A week sized to your household

### Cook for the people who are actually home

Set how many you are cooking for once per week. Add or remove a person and it follows. Open a recipe from the plan and it is already scaled to that week, and the shopping list agrees.

### A shopping list you can shop from

Cups and grams merge when we know the ingredient, three flour lines become one, and amounts come out in units you can actually buy.

## 2026-10-21 - Imports you can trust

### See it, then keep it

URL and paste imports show a preview before anything is saved. Agents get the same preview-then-save flow over MCP, and duplicates are caught before we fetch the page.

### When an import fails, you know why

Blocked sites, 404s, and pages that are not recipes each get a plain reason, in the app and as failure codes on REST and MCP, with Paste or Photo offered as the next step. For sites that block us outright, a bookmarklet sends the page from your own browser.

### Food rules you can't miss

A red can't-eat chip leads the recipe page, spicy rules catch chiles and other heat, and food rules are type-to-search.

## 2026-10-19 - Share your kitchen

### Invite your household

Invite people from Settings, over REST, or from your agent over MCP. They accept from a link and join as members.

### Roles that mean something

Viewers can look but not change anything. Only admins can edit people's food rules and loves. API keys stop working when the person who made them leaves the kitchen.

## 2026-10-15 - Edit the week, shop the aisles

### Pick, swap, or clear a night

Change any dinner on the plan, mark a night as no-cook, and undo any of it. Mark the week final when you are happy. Agents can edit nights over MCP too.

### One calm allergy notice

Warnings are written in plain language, one per person per meal, gathered into a single notice on the plan.

### A list grouped by aisle

The shopping list groups by aisle and remembers what you checked off. Add extras, remove items, or clear everything checked.

## 2026-10-14 [0.1.0] - OvenLovin 0.1.0

A family recipe box your agent can actually use, that knows who can't eat what.

### People and their food rules

Every person in the household gets three plain lists: Can't eat, Doesn't like, and Loves. Every recipe shows who can eat it. Allergen checks give the same answer every time, and a check with missing information stays incomplete instead of pretending to pass. Not medical advice. Always read the label.

### Recipes in, three ways

Import from a URL, paste text, or snap a recipe card, handwritten or printed, and review what OvenLovin read before saving. Organize recipes into cookbooks and scale servings.

### Meal plan and shopping list

Plan the week, see when a dinner runs past that night's time budget, and get a shopping list that merges, scales, and groups what you need.

### Built for agents

REST at `/api/v1` with a complete OpenAPI spec, and MCP at `/mcp` with tools for recipes, plans, people, and rules. Create named API keys for your bots and revoke them any time. `/docs`, `/docs/connect-your-agent`, and `/llms.txt` live on every instance.

### Try it, or run your own

Public demo sandboxes give anyone a kitchen and a 24h key, no sign-up. Deploy to Vercel provisions Neon, Blob, and Clerk and migrates the database for you.

[Unreleased]: https://github.com/tbarho/ovenlovin/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tbarho/ovenlovin/releases/tag/v0.1.0
