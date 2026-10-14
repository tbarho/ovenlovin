#!/usr/bin/env tsx
/**
 * Export OpenAPI spec for docs generation
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generateOpenApiDocument } from "../src/lib/api/openapi";

const spec = generateOpenApiDocument("https://ovenlovin.vercel.app");
const outputDir = join(__dirname, "../../docs/src/content/api");
const outputFile = join(outputDir, "openapi.json");

// Check if docs directory exists (it won't in Vercel deployments of just the web app)
const docsBaseDir = join(__dirname, "../../docs");
if (!existsSync(docsBaseDir)) {
  console.log("⏭️  Docs directory not found, skipping OpenAPI export");
  process.exit(0);
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(spec, null, 2)}\n`);

console.log(`✓ OpenAPI spec exported to ${outputFile}`);
