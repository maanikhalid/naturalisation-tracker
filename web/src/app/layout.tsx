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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-MRSBDXKH');`,
          }}
        />
      </head>
      <body>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-MRSBDXKH"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <PwaRegister />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
