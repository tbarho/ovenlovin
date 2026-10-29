# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each `## YYYY-MM-DD - Title` block is one ship day (UTC merge date on `main`). `apps/web` renders this file at `/changelog`, so write it for the people and agents who cook with OvenLovin: only changes they would notice and care about.

## [Unreleased]
- Book page numbers sit at the bottom on phone and desktop; demo share links stay off like print PDFs; disabled Share button now looks dimmed.

### Print your cookbook

In the book reader, tap Print and choose where it's headed. At home gets you a US Letter PDF of exactly the pages you paged through. At a print shop gets the same pages with bleed, crop marks, and embedded fonts, plus a heads-up if a photo will print soft. Big books are made in the background with a progress bar, so you can close the sheet and come back to the download.

### Share a cookbook with a link

Tap Share on a cookbook to make a private link anyone can open to read it as a book, no account needed. They can page through it but not edit it or see the rest of your kitchen. Tap Stop sharing and the link stops working. A cookbook with recipes from a published cookbook stays in your kitchen and can't be shared, and the page tells you why.

### Add a paper cookbook from its contents pages

For a book you can hold, photograph the contents or index pages. You get the same list of recipes to pick from, then a shot list with page numbers ("p. 112 Short ribs") so you know what to photograph next. Photograph each pick with the usual page photo import and it files into the book's cookbook, credited to its page.

### Read a cookbook as a book

Open a cookbook and tap Open book to page through it like the real thing: cover, contents, photos with the recipe name under them, and the index at the back. Turn pages by the edge arrows, the arrow keys, or a swipe, and on a phone it reads one page at a time.

### Pick recipes from a cookbook's contents page

Drop in a cookbook PDF and see its recipes listed by section with their page numbers, all picked. Search, select all or none, and your picks are saved for when the recipes come in.

### Turn a cookbook PDF into a cookbook

Pull your picks and each recipe lands as Ready or Needs a look, with the reason. Save every Ready one in one tap, fix the rest in the usual review form, and they file into a new cookbook named for the book, in book order. The shelf shows how many are ready, and each recipe says which book and page it came from.

## 2026-10-22 - A week sized to your household

### Cook for the people who are actually home

Set how many you are cooking for once per week. Add or remove a person and it follows. Open a recipe from the plan and it is already scaled to that week, and the shopping list agrees.

### A shopping list you can shop from

Cups and grams merge when we know the ingredient, three flour lines become one, and amounts come out in units you can actually buy.

## 2026-10-21 - Imports and food rules you can trust

### See it, then keep it

URL and paste imports show a preview before anything is saved. Agents get the same preview-then-save flow over MCP, and duplicates are caught. API keys only do what their scopes allow, on REST and MCP.

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
