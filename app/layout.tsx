import type { Metadata, Viewport } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

const SITE_URL = "https://zoom-hide.vercel.app";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TITLE = "Zoom Hide — hide, zoom, find";
const DESCRIPTION =
  "Hide a shape in a photo from your real life. Your friends zoom in to find it. 3 tries a day!";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Zoom Hide",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Zoom Hide" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-md min-h-dvh pb-28">{children}</main>
        <NavBar />
      </body>
    </html>
  );
}
