import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "OvenLovin",
  description: "LLM-optimized recipe and family meal-planning platform",
  icons: {
    icon: brandPublicPath.favicon,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ClerkReadyProvider>{children}</ClerkReadyProvider>
      </body>
    </html>
  );
}
