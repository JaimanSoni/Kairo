import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@/components/analytics";
import { PageTracker } from "@/components/track";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

const bodyFont = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const displayFont = Fraunces({
  variable: "--font-display-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT"],
});

export const metadata: Metadata = {
  // Without this, the per-page `alternates.canonical` values resolve to bare
  // paths — a canonical tag is meant to be absolute, and Open Graph images are
  // required to be.
  metadataBase: new URL(SITE_URL),
  // Search Console ownership — renders the google-site-verification meta tag
  verification: { google: "ZtLYr13WzGlwe7RYE0jWONSTmu4ZVUbmv7T4h94Y2Rk" },
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f6" },
    { media: "(prefers-color-scheme: dark)", color: "#131917" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Runs before paint: resolves the stored theme so there is no flash.
 *
 * A published note (/p/...) is always light. It's a page someone chose to
 * put in front of other people, so it should read the way it was written,
 * not the way each visitor's phone happens to be set; and its author,
 * checking it, should see what everyone else sees.
 */
const themeScript = `(function(){try{var pub=location.pathname.indexOf('/p/')===0;var t=localStorage.getItem('kairo-theme');var d=!pub&&(t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches));document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bodyFont.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
        <Analytics />
        <PageTracker />
      </body>
    </html>
  );
}
