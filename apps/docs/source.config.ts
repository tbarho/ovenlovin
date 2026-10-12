import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import type { InferMetaType, InferPageType } from 'fumadocs-core/source';

export const { docs, meta } = defineDocs({
  dir: 'src/content/docs',
});

export default defineConfig();

export type Page = InferPageType<typeof docs>;
export type Meta = InferMetaType<typeof meta>;
