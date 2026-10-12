#!/usr/bin/env tsx
/**
 * Export OpenAPI spec for docs generation
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateOpenApiDocument } from "../src/lib/api/openapi";

const spec = generateOpenApiDocument();
const outputDir = join(__dirname, "../../docs/src/content/api");
const outputFile = join(outputDir, "openapi.json");

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputFile, JSON.stringify(spec, null, 2));

console.log(`✓ OpenAPI spec exported to ${outputFile}`);
