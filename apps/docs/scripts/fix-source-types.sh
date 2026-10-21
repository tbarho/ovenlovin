#!/bin/bash
# Generate fumadocs map if missing, then mark docs/meta as any (line-agnostic).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .source/index.ts ]; then
  pnpm exec fumadocs-mdx
fi

if [ -f .source/index.ts ]; then
  sed -i -E 's/^export const docs = /export const docs: any = /' .source/index.ts
  sed -i -E 's/^export const meta = /export const meta: any = /' .source/index.ts
fi
