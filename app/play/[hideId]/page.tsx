"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import HideGame, { ERRORS, HideDetail } from "@/components/HideGame";

type DetailResponse = HideDetail & { error?: string };

export default function HidePage({ params }: { params: Promise<{ hideId: string }> }) {
  const { hideId } = use(params);
  const [detail, setDetail] = useState<HideDetail | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hide_detail", {
      p_hide_id: hideId,
      p_player_id: getPlayerId(),
    });
    if (error) {
      setLoadError("Hide not found.");
      return;
    }
    const d = data as DetailResponse;
    if (d.error) {
      setLoadError(ERRORS[d.error] ?? "Hide unavailable.");
      return;
    }
    setDetail(d);
  }, [hideId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadError) {
    return (
      <div className="px-6 pt-20 text-center flex flex-col gap-4">
        <p className="text-lg">{loadError}</p>
        <Link href="/play" className="text-violet-300 underline">← Back to feed</Link>
      </div>
    );
  }
  if (!detail) {
    return <p className="p-8 text-center text-white/60">Loading…</p>;
  }

  return <HideGame hideId={hideId} detail={detail} backHref="/play" backLabel="← Feed" />;
}
