"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Point d'entrée manuel : /play/private/[code] redirige ici s'il n'a pas de
// code, et cette page redirige vers /play/private/[code] une fois saisi.
export default function PrivateCodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const digits = code.replace(/\D/g, "").slice(0, 6);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.length === 6) router.push(`/play/private/${digits}`);
  };

  return (
    <div className="px-6 pt-16 flex flex-col gap-5">
      <h1 className="text-2xl font-black">🔒 Enter a private code</h1>
      <p className="text-white/70 text-sm">
        Someone sent you a 6-digit code for their private hide? Type it below.
      </p>
      <form onSubmit={go} className="flex flex-col gap-3">
        <input
          type="text"
          inputMode="numeric"
          autoFocus
          value={digits}
          onChange={(e) => setCode(e.target.value)}
          placeholder="482913"
          maxLength={6}
          className="w-full rounded-2xl bg-white/10 border border-white/15 px-4 py-4 text-center text-3xl tracking-[0.3em] font-black"
        />
        <button
          type="submit"
          disabled={digits.length !== 6}
          className="rounded-2xl bg-amber-400 text-black font-bold py-3.5 disabled:opacity-40 active:scale-95 transition"
        >
          Find it 🔎
        </button>
      </form>
      <Link href="/play" className="text-center text-violet-300 underline text-sm">
        ← Back to the public feed
      </Link>
    </div>
  );
}
