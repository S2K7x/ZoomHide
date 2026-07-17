"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HideGame from "@/components/HideGame";

const ERRORS: Record<string, string> = {
  not_found: "Invalid code or expired hide.",
  rate_limited: "Too many attempts. Try again in an hour.",
};

export default function PrivateGame({ code }: { code: string }) {
  const [hideId, setHideId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/resolve-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data?.id) setHideId(data.id as string);
        else setError(ERRORS[data?.error] ?? "Invalid code or expired hide.");
      } catch {
        if (!cancelled) setError("Network error, try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="px-6 pt-20 text-center flex flex-col gap-4">
        <p className="text-lg">🔒 {error}</p>
        <Link href="/play/private" className="text-violet-300 underline">
          Enter another code
        </Link>
        <Link href="/play" className="text-white/50 underline text-sm">
          Back to public feed
        </Link>
      </div>
    );
  }
  if (!hideId) {
    return <p className="p-8 text-center text-white/60">Unlocking hide…</p>;
  }
  return <HideGame hideId={hideId} backHref="/play/private" backLabel="Private" />;
}
