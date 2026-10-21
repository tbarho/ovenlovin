# Import evals

Live-model import evals for paste, photo, and URL extract. Not part of CI.

```bash
# all default models (DeepSeek, Luna, grok)
pnpm eval:import

# one model
EVAL_IMPORT_MODEL=deepseek/deepseek-v4.1-flash pnpm eval:import
EVAL_IMPORT_MODEL=openai/gpt-6-luna pnpm eval:import
EVAL_IMPORT_MODEL=spacexai/grok-4.7 pnpm eval:import
```

Needs `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, and Node.js 24+ for the eve CLI. The runner passes `eve eval --strict`, so a gated miss or a thrown model error exits non-zero.

## Scoring

The answer key for each case is the ingredient lines and step count as they appear in the fixture source (paste text, photo card text, or `pageTextFromHtml` of the saved page). A model line matches a key line when the two normalize equal (case, punctuation, unicode fractions), or when the shorter line has at least two tokens and those tokens all appear in the longer line. Matches are one-to-one, so one observed line cannot cover two keys. That is why "egg" does not match "egg noodles" and "sugar" does not match "brown sugar". Servings are scored only when the key has a number; omitted servings are not printed or averaged as 0%. A fixture that is scored against its own source must get 1.0.

## Why these evals call extractors instead of `t.send`

Eve's documented grading API is `defineEval` plus `t.score` / `t.check` on any locally computed value (`docs/evals/assertions.mdx`). These cases score the AI SDK importers, not an eve agent conversation, so they do not use `t.send` / `t.sendFile`. A `mockModel` fixture agent exists only because `eve eval` boots an agent server. Photo bytes go into `createPhotoImporter`; eve has no vision path into that importer.

Production import stays on the AI SDK and gateway in `@ovenlovin/importers`. This package only owns the eve runner. Eve 0.81 needs Node 24 and peers `ai@7`; those stay in this package's `devDependencies`. `eve eval` only treats a folder as a project when `dependencies.eve` is set, so the runner copies that field for the process and writes the file back.

## Photo fixtures

The eight photo cases live in `packages/importers/src/eval/fixtures/photo/*.jpg`. They are synthetic phone-style JPEGs from `packages/importers/src/eval/render-cards.py` (Pillow): cream cards on a desk, slight tilt, uneven light, JPEG compression. `handwritten-ginger-snaps.jpg` is lined paper with jittered serif "handwriting". `weeknight-chili.jpg` is a two-column cookbook spread. They are not real camera captures.

Regenerate with:

```bash
python3 packages/importers/src/eval/render-cards.py
```
