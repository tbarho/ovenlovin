import type { MetadataRoute } from "next";
import { brandPublicPath } from "@ovenlovin/brand";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OvenLovin",
    short_name: "OvenLovin",
    description: OVENLOVIN_PITCH,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#e07a3d",
    icons: [
      { src: brandPublicPath.favicon32, sizes: "32x32", type: "image/png" },
      { src: brandPublicPath.appleTouch, sizes: "180x180", type: "image/png" },
    ],
  };
}
