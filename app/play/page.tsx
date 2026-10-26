"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getShape, shapeDataUrl, HINT_COLOR } from "@/lib/stickers";
import { getPlayerId } from "@/lib/player";
import Avatar from "@/components/Avatar";
import Mascot from "@/components/Mascot";
import { LockIcon, RefreshIcon } from "@/components/Icons";

// Chaque vignette prend un aplat de la palette, en rotation.
const TILE_COLORS = ["var(--orange)", "var(--sky)", "var(--pink)", "var(--lime)", "var(--yellow)", "var(--purple)"];

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

const PAGE_SIZE = 20;
const SORT_KEY = "zh_feed_sort";
const SORTS: [Sort, string][] = [
  ["recent", "Newest"],
  ["hardest", "Hardest"],
  ["expiring", "Expiring"],
];

const isSort = (v: string | null): v is Sort => SORTS.some(([k]) => k === v);

export default function PlayFeed() {
  const [hides, setHides] = useState<Hide[]>([]);
  const [statuses, setStatuses] = useState<Record<string, "attempted" | "found">>({});
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hideDone, setHideDone] = useState(false);
  const [error, setError] = useState(false);
  // les préférences localStorage ne sont lisibles qu'après le montage : on
  // retarde le premier fetch pour ne pas le lancer deux fois (tri par défaut
  // puis tri mémorisé)
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const fetchHides = async (opts?: { isManual?: boolean; loadMore?: boolean }) => {
    const offset = opts?.loadMore ? hides.length : 0;
    if (opts?.loadMore) setLoadingMore(true);
    else if (opts?.isManual) setRefreshing(true);
    else setLoading(true);

    let q = supabase.from("active_hides").select("*");
    if (sort === "recent") q = q.order("created_at", { ascending: false });
    if (sort === "hardest") q = q.order("fail_pct", { ascending: false, nullsFirst: false });
    if (sort === "expiring") q = q.order("expires_at", { ascending: true });
    q = q.order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    const { data, error: fetchError } = await q;

    if (fetchError) {
      setError(true);
      setLoading(false);
      if (opts?.isManual) setRefreshing(false);
      if (opts?.loadMore) setLoadingMore(false);
      return;
    }
    setError(false);
    const list = (data as Hide[]) ?? [];
    setHides((prev) => (opts?.loadMore ? [...prev, ...list] : list));
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);

    if (list.length > 0) {
      const { data: statusData } = await supabase.rpc("get_hide_statuses", {
        p_hide_ids: list.map((h) => h.id),
        p_player_id: getPlayerId(),
      });
      setStatuses((prev) => ({
        ...(opts?.loadMore ? prev : {}),
        ...((statusData as Record<string, "attempted" | "found">) ?? {}),
      }));
    } else if (!opts?.loadMore) {
      setStatuses({});
    }
    if (opts?.isManual) setRefreshing(false);
    if (opts?.loadMore) setLoadingMore(false);
  };

  useEffect(() => {
    if (!prefsLoaded) return;
    fetchHides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, prefsLoaded]);

  useEffect(() => {
    const saved = localStorage.getItem(SORT_KEY);
    if (isSort(saved)) setSort(saved);
    setHideDone(localStorage.getItem("zh_hide_done") === "1");
    setPrefsLoaded(true);
  }, []);

  const changeSort = (next: Sort) => {
    setSort(next);
    localStorage.setItem(SORT_KEY, next);
  };

  const toggleHideDone = () => {
    setHideDone((prev) => {
      const next = !prev;
      localStorage.setItem("zh_hide_done", next ? "1" : "0");
      return next;
    });
  };

  const visibleHides = hideDone ? hides.filter((h) => !statuses[h.id]) : hides;

  const timeLeft = (iso: string) => {
    const h = Math.max(0, (new Date(iso).getTime() - Date.now()) / 3600000);
    return h >= 24 ? `${Math.ceil(h / 24)}d` : `${Math.ceil(h)}h`;
  };

  const emptyState = (mood: "sad" | "wow", text: React.ReactNode, action: React.ReactNode) => (
    <div className="zh-card text-center py-8 px-6 flex flex-col items-center gap-3">
      <Mascot shape="bean" mood={mood} color="var(--sky)" size={96} />
      <p className="text-[var(--muted)]">{text}</p>
      {action}
    </div>
  );

  return (
    <div className="px-4 pt-6 flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <h1 className="zh-display text-[2.8rem]">
          Find a
          <br />
          Hide
        </h1>
        <div className="flex flex-col gap-2 shrink-0 pt-1">
          <button
            onClick={() => fetchHides({ isManual: true })}
            disabled={loading || refreshing}
            aria-label="Refresh feed"
            className="zh-icon-btn disabled:opacity-50"
          >
            <RefreshIcon size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
          <Link
            href="/play/private"
            aria-label="Play a private hide with a code"
            className="zh-icon-btn"
          >
            <LockIcon size={20} />
          </Link>
        </div>
      </div>

      <div className="flex gap-2 text-sm overflow-x-auto zh-noscroll -mx-4 px-4 pb-1">
        {SORTS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => changeSort(k)}
            aria-pressed={sort === k}
            className={`zh-chip shrink-0 ${sort === k ? "zh-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={toggleHideDone}
          aria-pressed={hideDone}
          className={`zh-chip shrink-0 ${hideDone ? "zh-chip-on" : ""}`}
        >
          🙈 Hide tried/found
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3" aria-label="Loading hides">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="zh-tile bg-white p-2">
              <div className="w-full aspect-square rounded-[1.5rem] zh-skeleton" />
              <div className="p-2 flex items-center gap-2">
                <div className="w-[26px] h-[26px] rounded-full zh-skeleton shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5 py-0.5">
                  <div className="h-2.5 w-3/5 rounded zh-skeleton" />
                  <div className="h-2 w-4/5 rounded zh-skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        emptyState(
          "sad",
          <>Couldn&apos;t load hides. Check your connection.</>,
          <button onClick={() => fetchHides()} className="zh-btn zh-btn-primary px-5 py-2.5 text-sm">
            Try again
          </button>
        )
      ) : hides.length === 0 ? (
        emptyState(
          "wow",
          "No active hides yet.",
          <Link href="/create" className="zh-btn zh-btn-primary px-5 py-2.5 text-sm">
            Be the first to hide one!
          </Link>
        )
      ) : visibleHides.length === 0 ? (
        emptyState(
          "wow",
          <>No fresh hides on this page — you&apos;ve tried or found them all.</>,
          <button onClick={toggleHideDone} className="zh-btn zh-btn-ghost px-5 py-2.5 text-sm">
            Show them anyway
          </button>
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visibleHides.map((h, i) => (
            <Link
              key={h.id}
              href={`/play/${h.id}`}
              className="zh-tile zh-card-interactive p-2 flex flex-col"
              style={{ background: TILE_COLORS[i % TILE_COLORS.length] }}
            >
              <div className="relative overflow-hidden rounded-[1.5rem] bg-black/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.thumbnail_url}
                  alt="Hide"
                  className="w-full aspect-square object-cover"
                  loading="lazy"
                />
                <span className="zh-badge absolute top-2 right-2">
                  ⏳ {timeLeft(h.expires_at)}
                </span>
                <span className="absolute bottom-2 left-2 grid place-items-center w-9 h-9 rounded-full bg-white shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shapeDataUrl(h.sticker_id, HINT_COLOR)}
                    alt={getShape(h.sticker_id).name}
                    className="w-5 h-5"
                  />
                </span>
                {h.fail_pct != null && h.fail_pct >= 60 && (
                  <span className="zh-badge absolute top-2 left-2 !bg-ink !text-white">
                    🔥 HARD
                  </span>
                )}
                {statuses[h.id] === "found" ? (
                  <span className="zh-badge absolute bottom-2 right-2 !bg-teal !text-white">
                    ✓ Found
                  </span>
                ) : statuses[h.id] === "attempted" ? (
                  <span className="zh-badge absolute bottom-2 right-2">
                    👀 Tried
                  </span>
                ) : null}
              </div>
              <div className="px-1.5 pt-2.5 pb-1 flex items-center gap-2 text-ink">
                <Avatar name={h.creator_name} size={26} />
                <div className="min-w-0 text-xs">
                  <p className="font-bold truncate">{h.creator_name}</p>
                  <p className="text-ink/65 font-medium">
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

      {!loading && hides.length > 0 && hasMore && (
        <button
          onClick={() => fetchHides({ loadMore: true })}
          disabled={loadingMore}
          className="zh-btn zh-btn-primary py-3.5 text-sm disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
