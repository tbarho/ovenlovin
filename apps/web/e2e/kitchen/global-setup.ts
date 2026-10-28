import { execFileSync } from "node:child_process";
import path from "node:path";
import { request } from "@playwright/test";

const port = process.env.E2E_KITCHEN_PORT || "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

/** Next.js compiles these on first hit; do it before the test clock. */
export default async function globalSetup() {
  // The triage + paper-book specs save recipes; start those over so reruns work.
  if (process.env.DATABASE_URL) {
    execFileSync(
      "pnpm",
      ["exec", "tsx", "scripts/seed-e2e-kitchen.ts", "--fresh-book", "--fresh-shot"],
      {
        cwd: path.resolve(__dirname, "../.."),
        stdio: "inherit",
      }
    );
  }
  const api = await request.newContext({ baseURL });
  await Promise.all([
    api.get("/settings", { timeout: 120_000 }),
    api.get("/api/v1/households/settings", { timeout: 120_000 }),
  ]);
  await api.dispose();
}
