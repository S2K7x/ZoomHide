"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import HideGame from "@/components/HideGame";

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
    return <HideGame hideId={hideId} backHref="/play" backLabel="Feed" />;
  }

  // token en cours de résolution, sans erreur -> écran d'attente
  if (initialToken && UUID_RE.test(initialToken) === false && resolving) {
    return <p className="p-8 text-center text-white/60">Unlocking hide…</p>;
  }
  if (initialToken && UUID_RE.test(initialToken)) {
    return <p className="p-8 text-center text-white/60">Unlocking hide…</p>;
  }

  const go = () => {
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) resolveCode(clean);
  };

  return (
    <div className="px-6 pt-16 flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-3xl font-black">🔒 Private hide</h1>
        <p className="mt-2 text-white/70 text-sm">
          Got a 6-digit code from a friend? Enter it to unlock their hide.
        </p>
      </header>

      <input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={code}
        autoFocus
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="000000"
        className="w-full text-center tracking-[0.5em] text-3xl font-black rounded-2xl bg-white/10 border border-white/15 py-5"
      />

      {error && <p className="text-center text-red-300 text-sm">🔒 {error}</p>}

      <button
        onClick={go}
        disabled={code.length !== 6 || resolving}
        className="rounded-2xl bg-amber-400 text-black font-bold py-4 disabled:opacity-40 active:scale-95 transition"
      >
        {resolving ? "Unlocking…" : "Unlock hide 🔓"}
      </button>

      <Link href="/play" className="text-center text-violet-300 underline text-sm">
        ← Back to public feed
      </Link>
    </div>
  );
}
