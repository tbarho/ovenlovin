import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";
import { docs, meta } from "../../.source";

// Disable any lint because fumadocs-mdx generated types are incompatible
// eslint-disable-next-line
export const source: any = loader({
  baseUrl: "/docs",
  // eslint-disable-next-line
  source: createMDXSource(docs as any, meta as any),
});
