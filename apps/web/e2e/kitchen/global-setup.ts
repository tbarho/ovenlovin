import { request } from "@playwright/test";

const port = process.env.E2E_KITCHEN_PORT || "3100";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

/** Next.js compiles these on first hit; do it before the test clock. */
export default async function globalSetup() {
  const api = await request.newContext({ baseURL });
  await Promise.all([
    api.get("/settings", { timeout: 120_000 }),
    api.get("/api/v1/households/settings", { timeout: 120_000 }),
  ]);
  await api.dispose();
}
