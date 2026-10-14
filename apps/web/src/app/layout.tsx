import type { Metadata, Viewport } from "next";
import { Fascinate_Inline, Geist, Geist_Mono } from "next/font/google";
import { appShareUrl, brandPublicPath } from "@ovenlovin/brand";
import { ClerkReadyProvider } from "@/components/ClerkReadyProvider";
import { OVENLOVIN_PITCH } from "@/lib/llms-txt";
import { publicOrigin } from "@/lib/public-origin";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const fascinate = Fascinate_Inline({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

/** Safe-area + keyboard resize only. Do not set maximumScale or userScalable=false. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin()),
  title: "OvenLovin",
  description: OVENLOVIN_PITCH,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: brandPublicPath.favicon, type: "image/svg+xml" },
      { url: brandPublicPath.favicon32, sizes: "32x32", type: "image/png" },
    ],
    apple: brandPublicPath.appleTouch,
  },
  openGraph: {
    title: "OvenLovin",
    description: OVENLOVIN_PITCH,
    images: [
      { url: appShareUrl(brandPublicPath.og), width: 1200, height: 630, alt: OVENLOVIN_PITCH },
    ],
  },
  twitter: {
    card: "summary_large_image",
    description: OVENLOVIN_PITCH,
    images: [appShareUrl(brandPublicPath.og)],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fascinate.variable}`}>
      <body>
        <ClerkReadyProvider>{children}</ClerkReadyProvider>
      </body>
    </html>
  );
}
