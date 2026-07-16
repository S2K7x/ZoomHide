import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoom Hide — cache, zoome, trouve",
  description:
    "Cache un sticker dans une photo de ta vraie vie. Tes amis zooment pour le retrouver. 3 essais par jour !",
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
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-md min-h-dvh pb-20">{children}</main>
        <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/10 bg-[#1a0d2e]/95 backdrop-blur">
          <div className="mx-auto max-w-md grid grid-cols-4 text-center text-xs">
            {[
              { href: "/", icon: "🏠", label: "Accueil" },
              { href: "/play", icon: "🔎", label: "Chercher" },
              { href: "/create", icon: "📸", label: "Cacher" },
              { href: "/leaderboard", icon: "🏆", label: "Classement" },
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
