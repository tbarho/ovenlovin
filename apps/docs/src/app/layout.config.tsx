import { BrandWordmark } from "@/components/brand-wordmark";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  githubUrl: "https://github.com/tbarho/ovenlovin",
  nav: {
    title: <BrandWordmark />,
    url: "/",
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
    },
    {
      text: "Changelog",
      url: "https://ovenlovin-demo.vercel.app/changelog",
      external: true,
    },
  ],
};
