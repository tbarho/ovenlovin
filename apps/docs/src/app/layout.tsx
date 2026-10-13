import { withBasePath } from "@/lib/base-path";
import { brandPublicPath } from "@ovenlovin/brand";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider";
import { Bagel_Fat_One, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const bagel = Bagel_Fat_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  icons: {
    icon: [
      { url: withBasePath(brandPublicPath.favicon), type: "image/svg+xml" },
      { url: withBasePath(brandPublicPath.favicon32), sizes: "32x32", type: "image/png" },
    ],
    apple: withBasePath(brandPublicPath.appleTouch),
  },
  openGraph: {
    title: "OvenLovin Documentation",
    description:
      "LLM-optimized recipe and family meal-planning platform. Built for AI agents to help families manage weekly meal planning with per-person dietary rules and allergy checking.",
    images: [{ url: withBasePath(brandPublicPath.og), width: 1200, height: 630, alt: "OvenLovin" }],
  },
  twitter: {
    card: "summary_large_image" as const,
    images: [withBasePath(brandPublicPath.og)],
  },
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
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${bagel.variable}`}
    >
      <body className="font-sans">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
