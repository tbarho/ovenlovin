import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/public-origin";

export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/prototype/", "/dev/", "/sign-in", "/sign-up"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
