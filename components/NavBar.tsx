"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/play", icon: "🔎", label: "Find" },
  { href: "/create", icon: "📸", label: "Hide" },
  { href: "/leaderboard", icon: "🏆", label: "Ranks" },
];

export default function NavBar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="mx-auto max-w-md px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-4 rounded-3xl border border-white/10 bg-[#0e1735]/90 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.9)]">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="flex flex-col items-center gap-1 py-2.5"
              >
                <span
                  className={`grid place-items-center w-10 h-10 rounded-2xl text-lg transition ${
                    active
                      ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_8px_18px_-8px_rgba(246,184,30,0.7)]"
                      : "text-white/55"
                  }`}
                >
                  {l.icon}
                </span>
                <span
                  className={`text-[11px] font-semibold ${
                    active ? "text-white" : "text-white/45"
                  }`}
                >
                  {l.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
