# Import evals

Live-model import evals for paste, photo, and URL extract. Not part of CI.

```bash
pnpm eval:import
```

Needs `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`, and Node.js 24+ for the eve CLI. OvenLovin production import stays on the AI SDK and gateway in `@ovenlovin/importers`. This package only owns the eve runner.

Eve cannot drive our photo importer through `t.send` / `t.sendFile` (no vision fixture path into `createPhotoImporter`). Cases call the existing extractors and record `t.score` / `t.check`. A mock-model fixture agent exists only so `eve eval` can boot.

Eve 0.81 also requires Node 24 and peers `ai@7`. Those stay here; importers remain on AI SDK 5.
