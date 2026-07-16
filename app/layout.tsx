import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoom Hide — hide, zoom, find",
  description:
    "Hide a shape in a photo from your real life. Your friends zoom in to find it. 3 tries a day!",
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
        <main className="mx-auto max-w-md min-h-dvh pb-20">{children}</main>
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#1a0d2e]/95 backdrop-blur">
          <div className="mx-auto max-w-md grid grid-cols-4 text-center text-xs">
            {[
              { href: "/", icon: "🏠", label: "Home" },
              { href: "/play", icon: "🔎", label: "Find" },
              { href: "/create", icon: "📸", label: "Hide" },
              { href: "/leaderboard", icon: "🏆", label: "Ranking" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex flex-col items-center gap-0.5 py-2.5 text-white/70 hover:text-white"
              >
                <span className="text-lg leading-none">{l.icon}</span>
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </body>
    </html>
  );
}
