# @ovenlovin/importers

Recipe import pipeline for OvenLovin. Supports URL, pasted text, and photo/OCR imports.

## Architecture

All importers implement a common `Importer` interface:

```typescript
interface Importer<TInput> {
  canHandle(input: TInput): boolean;
  extract(input: TInput): Promise<RawExtraction>;
  toDraft(raw: RawExtraction): Promise<RecipeDraft>;
}
```

## Pipeline

**capture → extract → structure → normalize → enrich → score → review → publish**

1. **Capture**: Original artifact retained for provenance
2. **Extract**: Source-specific extraction (JSON-LD, OCR, etc.)
3. **Structure**: LLM structuring with strict zod schema
4. **Normalize**: Canonical ingredient + unit mapping
5. **Enrich**: Allergen mapping, nutrition, tags, method detection
6. **Score**: Per-field and overall `parse_confidence` (0-1)
7. **Review**: Low confidence or ambiguous fields → `needs_review` queue
8. **Publish**: Dedupe + suggest merge

## Importers

### URL Importer

- Fetch layers: live Firefox document headers (including Accept-Encoding so Food Network gzip works), related URLs on 404, then Google Translate and Jina public copies
- schema.org Recipe JSON-LD (primary)
- HTML / markdown recipe-card fallback (Wikibooks, Jina)
- Cheap LLM fallback (`openai/gpt-4o-mini` via Vercel AI Gateway, override with `RK_MODEL_EXTRACT`)
- "No recipe found on this page" when the page loaded but is not a recipe (example.com)
- "This site blocked the importer (tried ...)" only after every layer failed

### Pasted Text Importer

- LLM structuring with deterministic ingredient parser
- Most common bot path

### Photo/OCR Importer

- Vision model OCR (multi-page support)
- Handwritten recipe support with confidence scoring
- Side-by-side review for low-confidence parses

## Confidence Scoring

Each importer produces per-field confidence scores:

- `1.0`: Extracted from structured data (JSON-LD, schema.org)
- `0.8-0.9`: High-confidence LLM extraction
- `0.6-0.7`: Medium confidence (ambiguous units, missing data)
- `0.4-0.5`: Low confidence (handwritten, poor OCR)
- `< 0.4`: Needs review

## Eval Fixtures

Each importer has test fixtures in `__tests__/fixtures/<source>/`:

- Input files (URLs, text, images)
- Expected output (recipe drafts)
- Recorded confidence scores
- Regression thresholds enforced in CI

## AI Stack

All LLM calls use the Vercel AI SDK with AI Gateway:

- Model strings like `grok/grok-2-latest`
- OIDC auth on Vercel (no provider API keys)
- Provider fallbacks and usage observability
- Default models from env: `RK_MODEL_DEFAULT`, `RK_MODEL_VISION`, `RK_MODEL_STT`

## Usage

```typescript
import { createUrlImporter, createPasteImporter, createPhotoImporter } from '@ovenlovin/importers';

const urlImporter = createUrlImporter({ modelId: 'grok/grok-2-latest' });
const extraction = await urlImporter.extract({ url: 'https://example.com/recipe' });
const draft = await urlImporter.toDraft(extraction);
```

## Safety

- Never invent quantities; unknowns become `null` + flagged
- Always preserve `rawText` on ingredients
- Allergen-relevant ambiguities trigger `needs_review`
- OCR errors (plurals, misspellings) handled in allergen matching downstream
