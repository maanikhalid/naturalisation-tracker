import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const siteDescription =
  "Community tracker for UK naturalisation (Form AN) processing timelines. Not an official Home Office service.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "UK Naturalisation Tracker",
    template: "%s | UK Naturalisation Tracker",
  },
  description: siteDescription,
  applicationName: "UK Naturalisation Tracker",
  keywords: [
    "naturalisation",
    "Form AN",
    "UK citizenship",
    "British citizenship",
    "processing times",
    "Home Office",
  ],
  authors: [{ name: "Naturalisation Tracker" }],
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: "UK Naturalisation Tracker",
    title: "UK Naturalisation Tracker",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "UK Naturalisation Tracker",
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    title: "AN Tracker",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#1d70b8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>
        <PwaRegister />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
