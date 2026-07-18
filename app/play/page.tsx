"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getShape, shapeDataUrl, HINT_COLOR } from "@/lib/stickers";
import { getPlayerId } from "@/lib/player";
import Avatar from "@/components/Avatar";

type Hide = {
  id: string;
  creator_name: string;
  thumbnail_url: string;
  sticker_id: string;
  sticker_color: string;
  created_at: string;
  expires_at: string;
  total_attempts: number;
  finds: number;
  fail_pct: number | null;
};

type Sort = "recent" | "hardest" | "expiring";

export default function PlayFeed() {
  const [hides, setHides] = useState<Hide[]>([]);
  const [statuses, setStatuses] = useState<Record<string, "attempted" | "found">>({});
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from("active_hides").select("*");
      if (sort === "recent") q = q.order("created_at", { ascending: false });
      if (sort === "hardest") q = q.order("fail_pct", { ascending: false, nullsFirst: false });
      if (sort === "expiring") q = q.order("expires_at", { ascending: true });
      const { data } = await q.limit(60);
      const list = (data as Hide[]) ?? [];
      setHides(list);
      setLoading(false);

      if (list.length > 0) {
        const { data: statusData } = await supabase.rpc("get_hide_statuses", {
          p_hide_ids: list.map((h) => h.id),
          p_player_id: getPlayerId(),
        });
        setStatuses((statusData as Record<string, "attempted" | "found">) ?? {});
      } else {
        setStatuses({});
      }
    })();
  }, [sort]);

  const timeLeft = (iso: string) => {
    const h = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3600000);
    return h >= 24 ? `${Math.ceil(h / 24)}d` : `${Math.ceil(h)}h`;
  };

  return (
    <div className="px-4 pt-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Active hides</h1>
        <Link
          href="/play/private"
          className="zh-btn zh-btn-ghost px-3.5 py-2 text-xs"
        >
          🔒 Have a code?
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {(
          [
            ["recent", "Newest"],
            ["hardest", "Hardest"],
            ["expiring", "Expiring"],
          ] as [Sort, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3.5 py-1.5 border transition ${
              sort === k
                ? "bg-gradient-to-b from-amber-300 to-amber-500 text-black border-amber-400 font-bold"
                : "border-white/15 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-white/55 py-16">Loading…</p>
      ) : hides.length === 0 ? (
        <div className="zh-card text-center py-10 px-6 text-white/60 flex flex-col gap-2">
          <p>No active hides yet.</p>
          <Link href="/create" className="text-amber-300 font-semibold underline">
            Be the first to hide one!
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {hides.map((h) => (
            <Link
              key={h.id}
              href={`/play/${h.id}`}
              className="zh-card overflow-hidden active:scale-[0.97] transition"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.thumbnail_url}
                  alt="Hide"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <span className="absolute top-2 right-2 rounded-full bg-black/55 backdrop-blur text-[11px] font-semibold px-2 py-0.5">
                  ⏳ {timeLeft(h.expires_at)}
                </span>
                <span className="absolute bottom-2 left-2 grid place-items-center w-8 h-8 rounded-xl bg-black/55 backdrop-blur">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shapeDataUrl(h.sticker_id, HINT_COLOR)}
                    alt={getShape(h.sticker_id).name}
                    className="w-5 h-5"
                  />
                </span>
                {h.fail_pct != null && h.fail_pct >= 60 && (
                  <span className="absolute top-2 left-2 rounded-full bg-gradient-to-b from-rose-400 to-rose-600 text-[10px] font-black px-2 py-0.5">
                    🔥 HARD
                  </span>
                )}
                {statuses[h.id] === "found" ? (
                  <span className="absolute bottom-2 right-2 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 text-[10px] font-black px-2 py-0.5">
                    ✅ Found
                  </span>
                ) : statuses[h.id] === "attempted" ? (
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/55 backdrop-blur text-[10px] font-semibold px-2 py-0.5">
                    👀 Tried
                  </span>
                ) : null}
              </div>
              <div className="p-2.5 flex items-center gap-2">
                <Avatar name={h.creator_name} size={26} />
                <div className="min-w-0 text-xs">
                  <p className="font-semibold truncate">{h.creator_name}</p>
                  <p className="text-white/45">
                    {h.total_attempts === 0
                      ? "Not tried yet"
                      : `${h.fail_pct}% fail · ${h.finds} found`}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
