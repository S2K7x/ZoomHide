"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getShape, shapeDataUrl } from "@/lib/stickers";

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
      setHides((data as Hide[]) ?? []);
      setLoading(false);
    })();
  }, [sort]);

  const timeLeft = (iso: string) => {
    const h = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3600000);
    return h >= 24 ? `${Math.ceil(h / 24)}d` : `${Math.ceil(h)}h`;
  };

  return (
    <div className="px-4 pt-8 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">🔎 Active hides</h1>
        <Link href="/play/private" className="text-xs text-white/50 underline">
          🔒 Got a code?
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {(
          [
            ["recent", "Newest"],
            ["hardest", "Hardest"],
            ["expiring", "Expiring soon"],
          ] as [Sort, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`rounded-full px-3.5 py-1.5 border ${
              sort === k
                ? "bg-amber-400 text-black border-amber-400 font-bold"
                : "border-white/20 text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-white/60 py-10">Loading…</p>
      ) : hides.length === 0 ? (
        <div className="text-center py-10 text-white/60">
          <p>No active hides yet.</p>
          <Link href="/create" className="text-violet-300 underline">
            Be the first to hide one!
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {hides.map((h) => (
            <Link
              key={h.id}
              href={`/play/${h.id}`}
              className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 active:scale-95 transition"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.thumbnail_url}
                  alt="Hide"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <span className="absolute top-1.5 right-1.5 rounded-full bg-black/60 text-[11px] px-2 py-0.5">
                  ⏳ {timeLeft(h.expires_at)}
                </span>
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shapeDataUrl(h.sticker_id, h.sticker_color)}
                    alt={getShape(h.sticker_id).name}
                    className="w-5 h-5"
                  />
                </span>
              </div>
              <div className="p-2 text-xs">
                <p className="font-semibold truncate">{h.creator_name}</p>
                <p className="text-white/60">
                  {h.total_attempts === 0
                    ? "No one has tried yet"
                    : `${h.fail_pct}% fail · ${h.finds} found`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
