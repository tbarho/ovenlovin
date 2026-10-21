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

The answer key for each case is the hand-written record in `packages/importers/src/eval/fixtures/answer-keys.json` (title and aliases, servings and `acceptServings`, every ingredient `food`, step count and `acceptStepCounts`). Keys were written from the source text, not from the importer parser.

A model line matches a key when the key `food` appears as whole words in the model's full line (`rawText` for paste/photo, the extracted line for URL). Matches are one-to-one, longest food first. A line whose food is a different modified food does not count: "1 cup brown sugar" does not satisfy food "sugar"; it does satisfy food "brown sugar". Leading bullets, unit abbreviations, hyphen vs space, title aliases, and the accept lists are tolerated.

The import score is the min of title, ingredient recall, ingredient precision, and step completeness, so one missing or invented ingredient fails the 0.95 gate. Servings are scored separately when `acceptServings` is non-empty and are not part of that min (a servings miss is labeled separately). The self-check is the agreement test: every human-correct row in `golden-extractions.json` must score at or above the gate.

## Why these evals call extractors instead of `t.send`

Eve's documented grading API is `defineEval` plus `t.score` / `t.check` on any locally computed value (`docs/evals/assertions.mdx`). These cases score the AI SDK importers, not an eve agent conversation, so they do not use `t.send` / `t.sendFile`. A `mockModel` fixture agent exists only because `eve eval` boots an agent server. Photo bytes go into `createPhotoImporter`; eve has no vision path into that importer.

Production import stays on the AI SDK and gateway in `@ovenlovin/importers`. This package only owns the eve runner. Eve 0.81 needs Node 24 and peers `ai@7`; those stay in this package's `devDependencies`. `eve eval` only treats a folder as a project when `dependencies.eve` is set, so the runner copies that field for the process and writes the file back.

## Photo fixtures

The eight photo cases live in `packages/importers/src/eval/fixtures/photo/*.jpg`. They are synthetic phone-style JPEGs from `packages/importers/src/eval/render-cards.py` (Pillow): cream cards on a desk, slight tilt, uneven light, JPEG compression. `handwritten-ginger-snaps.jpg` is lined paper with jittered serif "handwriting". `weeknight-chili.jpg` is a two-column cookbook spread. They are not real camera captures.

Regenerate with:

```bash
python3 packages/importers/src/eval/render-cards.py
```
