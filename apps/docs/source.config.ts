import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { rehypeCode } from "fumadocs-core/mdx-plugins";

// Disable any lint because fumadocs-mdx generated types are incompatible
// eslint-disable-next-line
export const { docs, meta }: any = defineDocs({
  dir: "src/content/docs",
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: [
      [
        rehypeCode,
        {
          themes: {
            light: "github-light",
            dark: "github-dark",
          },
        },
      ],
    ],
  },
});
