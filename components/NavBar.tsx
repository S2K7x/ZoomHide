"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import { HomeIcon, SearchIcon, CameraIcon, TrophyIcon, LockIcon } from "@/components/Icons";
import Logo from "@/components/Logo";
import PlayerChip from "@/components/PlayerChip";

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

  // Mobile : pilule sombre flottante en bas (pouce). Tablette/desktop : en-tête
  // collant en haut, logo à gauche, même pilule au centre (libellés visibles),
  // profil et accès au code privé à droite.
  return (
    <>
      <header className="zh-header hidden md:block sticky top-0 z-50">
        <div className="mx-auto max-w-[72rem] px-8 lg:px-10 h-[4.5rem] flex items-center justify-between gap-6">
          <Link href="/" aria-label="Zoom Hide home" className="shrink-0 rounded-2xl">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 rounded-full bg-ink p-1.5 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.7)]">
            {LINKS.map(({ href, Icon, label }) => {
              const active = isActive(href);
              const showActiveHideDot = href === "/create" && hasActiveHide && !active;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 h-10 px-4 rounded-full text-sm font-bold transition-colors duration-200 ${
                    active ? "bg-teal text-white" : "text-white/75 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                  {showActiveHideDot && (
                    <span
                      className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal ring-2 ring-ink"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/play/private" aria-label="Play a private hide with a code" className="zh-icon-btn">
              <LockIcon size={19} />
            </Link>
            <PlayerChip />
          </div>
        </div>
      </header>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none">
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
    </>
  );
}
