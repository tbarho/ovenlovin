import { loader } from "fumadocs-core/source";
import { createMDXSource } from "fumadocs-mdx";
import { docs, meta } from "../../.source";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const source: any = loader({
  baseUrl: "/docs",
  source: createMDXSource(docs as any, meta as any),
});
