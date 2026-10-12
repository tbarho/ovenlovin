import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: {
    default: "OvenLovin Documentation",
    template: "%s | OvenLovin",
  },
  description:
    "LLM-optimized recipe and family meal-planning platform. Built for AI agents to help families manage weekly meal planning with per-person dietary rules and allergy checking.",
  keywords: [
    "recipe management",
    "meal planning",
    "allergy tracking",
    "AI agents",
    "MCP",
    "Model Context Protocol",
    "dietary restrictions",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
