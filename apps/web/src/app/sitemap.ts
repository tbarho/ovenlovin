import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-origin";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  return [
    { url: `${origin}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/docs`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/docs/connect-your-agent`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/changelog`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${origin}/llms.txt`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
