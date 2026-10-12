import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { rehypeCode } from "fumadocs-core/mdx-plugins";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
