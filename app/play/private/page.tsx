"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PrivateCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const go = () => {
    const clean = code.replace(/\D/g, "").slice(0, 6);
    if (clean.length === 6) router.push(`/play/private/${clean}`);
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

      <button
        onClick={go}
        disabled={code.length !== 6}
        className="rounded-2xl bg-amber-400 text-black font-bold py-4 disabled:opacity-40 active:scale-95 transition"
      >
        Unlock hide 🔓
      </button>

      <Link href="/play" className="text-center text-violet-300 underline text-sm">
        ← Back to public feed
      </Link>
    </div>
  );
}
