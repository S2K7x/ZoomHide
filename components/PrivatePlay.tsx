"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HideGame from "@/components/HideGame";
import GameSkeleton from "@/components/GameSkeleton";
import Mascot, { Sparkle } from "@/components/Mascot";
import { BackIcon } from "@/components/Icons";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ERRORS: Record<string, string> = {
  not_found: "Invalid code or expired hide.",
  rate_limited: "Too many attempts. Try again in an hour.",
};

// Accès aux cachettes privées.
// - initialToken = UUID  -> on joue directement (lien de partage opaque).
// - sinon                -> saisie du code, résolu via /api/resolve-code SANS
//                           jamais mettre le code dans l'URL.
export default function PrivatePlay({ initialToken }: { initialToken?: string }) {
  const [hideId, setHideId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [resolving, setResolving] = useState(false);

  const resolveCode = useCallback(async (raw: string) => {
    setResolving(true);
    setError("");
    try {
      const res = await fetch("/api/resolve-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: raw }),
      });
      const data = await res.json();
      if (data?.id) setHideId(data.id as string);
      else setError(ERRORS[data?.error] ?? "Invalid code or expired hide.");
    } catch {
      setError("Network error, try again.");
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (!initialToken) return;
    if (UUID_RE.test(initialToken)) {
      setHideId(initialToken);
    } else if (/^\d{6}$/.test(initialToken)) {
      // ancien lien avec code dans l'URL : on résout quand même
      resolveCode(initialToken);
    } else {
      setError("Invalid code or expired hide.");
    }
  }, [initialToken, resolveCode]);

  if (hideId) {
    return <HideGame hideId={hideId} backHref="/play" backLabel="the public feed" />;
  }

  // token en cours de résolution, sans erreur -> écran d'attente. Squelette de
  // l'écran de jeu (et non un texte) : c'est lui qui suit, la transition est
  // donc sans rupture. Le libellé reste porté par l'`aria-label`.
  if (initialToken && (UUID_RE.test(initialToken) || resolving)) {
    return <GameSkeleton label="Unlocking hide" />;
  }

  const go = () => {
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) resolveCode(clean);
  };

  return (
    <div className="px-5 pt-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <h1 className="zh-display text-[2.8rem]">
          Private
          <br />
          Hide
        </h1>
        <Link href="/play" aria-label="Back to public feed" className="zh-icon-btn">
          <BackIcon size={20} />
        </Link>
      </div>

      <div className="zh-tile bg-purple text-white p-5 pb-6 flex flex-col gap-4">
        <Sparkle size={16} className="zh-twinkle absolute top-5 right-6 text-yellow" />
        <div className="flex items-center gap-3">
          <Mascot shape="cat" mood="wow" color="var(--yellow)" size={72} className="shrink-0" />
          <p className="text-sm font-semibold text-white/90">
            Got a 6-digit code from a friend? Enter it to unlock their hide.
          </p>
        </div>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          autoFocus
          aria-label="6-digit code"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="000000"
          className="w-full text-center tracking-[0.45em] zh-display text-4xl rounded-[1.6rem] bg-white text-ink placeholder:text-ink/20 py-5 focus-visible:outline-none focus:outline-none focus:ring-4 focus:ring-yellow"
        />
        {error && (
          <p className="text-center text-sm font-bold rounded-full bg-white/15 py-2">🔒 {error}</p>
        )}
        <button
          onClick={go}
          disabled={code.length !== 6 || resolving}
          className="zh-btn zh-btn-primary py-4 text-base"
        >
          {resolving ? "Unlocking…" : "Unlock hide 🔓"}
        </button>
      </div>
    </div>
  );
}
