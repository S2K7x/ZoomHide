"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { HomeIcon, SearchIcon, CameraIcon, TrophyIcon } from "@/components/Icons";

const LINKS = [
  { href: "/", Icon: HomeIcon, label: "Home" },
  { href: "/play", Icon: SearchIcon, label: "Find" },
  { href: "/create", Icon: CameraIcon, label: "Hide" },
  { href: "/leaderboard", Icon: TrophyIcon, label: "Ranks" },
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

  // Pilule sombre façon « My Games » : l'onglet actif s'étire en pilule teal
  // avec son libellé, les autres restent des pastilles blanches rondes.
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-md px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ink p-1.5 shadow-[0_18px_36px_-16px_rgba(0,0,0,0.65)]">
          {LINKS.map(({ href, Icon, label }) => {
            const active = isActive(href);
            const showActiveHideDot = href === "/create" && hasActiveHide && !active;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={active ? undefined : label}
                className={`relative flex items-center justify-center h-12 rounded-full transition-all duration-300 ${
                  active
                    ? "bg-teal text-white px-5 gap-2"
                    : "bg-white text-ink w-12"
                }`}
              >
                <Icon size={21} />
                {active && <span className="text-sm font-bold">{label}</span>}
                {showActiveHideDot && (
                  <span
                    className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-teal ring-2 ring-white"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
