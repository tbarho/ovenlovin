import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/eval/import.eval.ts"],
    fileParallelism: false,
    testTimeout: 40 * 60 * 1000,
  },
});
