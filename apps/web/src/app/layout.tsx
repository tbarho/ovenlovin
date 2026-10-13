import type { Metadata } from "next";
import { Bagel_Fat_One, Geist, Geist_Mono } from "next/font/google";
import { brandPublicPath } from "@ovenlovin/brand";
import { ClerkReadyProvider } from "@/components/ClerkReadyProvider";
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

export const metadata: Metadata = {
  title: "OvenLovin",
  description: "LLM-optimized recipe and family meal-planning platform",
  icons: {
    icon: [
      { url: brandPublicPath.favicon, type: "image/svg+xml" },
      { url: brandPublicPath.favicon32, sizes: "32x32", type: "image/png" },
    ],
    apple: brandPublicPath.appleTouch,
  },
  openGraph: {
    title: "OvenLovin",
    description: "LLM-optimized recipe and family meal-planning platform",
    images: [{ url: brandPublicPath.og, width: 1200, height: 630, alt: "OvenLovin" }],
  },
  twitter: {
    card: "summary_large_image",
    images: [brandPublicPath.og],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bagel.variable}`}>
      <body>
        <ClerkReadyProvider>{children}</ClerkReadyProvider>
      </body>
    </html>
  );
}
