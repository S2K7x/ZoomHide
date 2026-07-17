"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import HideGame, { HideDetail } from "@/components/HideGame";

type DetailResponse = HideDetail & { error?: string };

// Message volontairement générique : on ne distingue jamais "code inexistant"
// de "code mal formé/expiré" pour ne pas donner de signal à un bruteforce.
// Le rate limit (10 essais/h/IP, vérifié côté RPC get_hide_by_code) a sa
// propre erreur pour rester actionnable côté joueur légitime.
const GENERIC_ERROR = "Invalid or expired code.";
const RATE_LIMIT_ERROR = "Too many attempts. Try again in a bit.";

export default function PrivateHidePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [detail, setDetail] = useState<HideDetail | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hide_by_code", {
      p_code: code,
      p_player_id: getPlayerId(),
    });
    if (error) {
      setLoadError(GENERIC_ERROR);
      return;
    }
    const d = data as DetailResponse;
    if (d.error === "rate_limited") {
      setLoadError(RATE_LIMIT_ERROR);
      return;
    }
    if (d.error) {
      setLoadError(GENERIC_ERROR);
      return;
    }
    setDetail(d);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="px-6 pt-20 text-center flex flex-col gap-4">
        <p className="text-lg">{loadError}</p>
        <Link href="/play/private" className="text-violet-300 underline">← Try another code</Link>
      </div>
    );
  }
  if (!detail) {
    return <p className="p-8 text-center text-white/60">Loading…</p>;
  }

  return <HideGame hideId={detail.id} detail={detail} backHref="/play/private" backLabel="← Code" />;
}
