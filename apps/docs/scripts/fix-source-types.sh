#!/bin/bash
# Fix type errors in auto-generated .source/index.ts

sed -i '27s/^export const docs = /\/\/ eslint-disable-next-line\nexport const docs: any = /' .source/index.ts
sed -i '29s/^export const meta = /\/\/ eslint-disable-next-line\nexport const meta: any = /' .source/index.ts
