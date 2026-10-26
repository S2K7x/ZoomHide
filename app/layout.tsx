import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

// Display grasse et ronde pour les titres, sans-serif douce pour le texte.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-bricolage",
});
const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
});

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
  themeColor: "#f3efe4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-md min-h-dvh pb-28">{children}</main>
        <NavBar />
      </body>
    </html>
  );
}
