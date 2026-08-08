"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";

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

  // Rappel visuel qu'une cachette est déjà active, peu importe la page —
  // sinon ce n'était visible qu'en ouvrant /create. Un seul appel RPC par
  // session (NavBar ne remonte pas entre les navigations client-side).
  const [hasActiveHide, setHasActiveHide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("has_active_hide", { p_creator_id: getPlayerId() })
      .then(({ data }) => {
        if (!cancelled) setHasActiveHide(Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="mx-auto max-w-md px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-4 rounded-3xl border border-white/10 bg-[#0e1735]/85 backdrop-blur-xl shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/5">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            const showActiveHideDot = l.href === "/create" && hasActiveHide && !active;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-2.5 rounded-2xl"
              >
                <span
                  className={`relative grid place-items-center w-10 h-10 rounded-2xl text-lg transition duration-200 ${
                    active
                      ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black scale-105 ring-1 ring-white/30 shadow-[0_8px_18px_-8px_rgba(246,184,30,0.7)]"
                      : "text-white/55"
                  }`}
                >
                  {l.icon}
                  {showActiveHideDot && (
                    <span
                      className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0e1735]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span
                  className={`text-[11px] font-semibold transition-colors ${
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
