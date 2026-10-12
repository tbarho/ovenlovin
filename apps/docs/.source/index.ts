// @ts-nocheck -- skip type checking
import * as docs_3 from "../src/content/docs/quickstart.mdx?collection=docs&hash=1791842928816";
import * as docs_2 from "../src/content/docs/index.mdx?collection=docs&hash=1791842928816";
import * as docs_1 from "../src/content/docs/concepts.mdx?collection=docs&hash=1791842928816";
import * as docs_0 from "../src/content/docs/agents.mdx?collection=docs&hash=1791842928816";
import { _runtime } from "fumadocs-mdx";
import * as _source from "../source.config";
export const docs = _runtime.doc<typeof _source.docs>([
  {
    info: { path: "agents.mdx", absolutePath: "/workspace/apps/docs/src/content/docs/agents.mdx" },
    data: docs_0,
  },
  {
    info: {
      path: "concepts.mdx",
      absolutePath: "/workspace/apps/docs/src/content/docs/concepts.mdx",
    },
    data: docs_1,
  },
  {
    info: { path: "index.mdx", absolutePath: "/workspace/apps/docs/src/content/docs/index.mdx" },
    data: docs_2,
  },
  {
    info: {
      path: "quickstart.mdx",
      absolutePath: "/workspace/apps/docs/src/content/docs/quickstart.mdx",
    },
    data: docs_3,
  },
]);
export const meta = _runtime.meta<typeof _source.meta>([]);
