"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import Avatar from "@/components/Avatar";

type Row = {
  name: string;
  player_id: string;
  score: number;
  finds?: number;
  fails_caused?: number;
  perfect_hides?: number;
};

export default function LeaderboardPage() {
  const [board, setBoard] = useState<"hiders" | "seekers">("hiders");
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState("");

  useEffect(() => {
    setMe(getPlayerId());
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_leaderboard", {
        p_board: board,
        p_period: period,
      });
      setRows((data as Row[]) ?? []);
      setLoading(false);
    })();
  }, [board, period]);

  const sub = (r: Row) =>
    board === "hiders"
      ? `${r.fails_caused ?? 0} misses · ${r.perfect_hides ?? 0}💎`
      : `${r.finds ?? 0} found`;

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  // ordre visuel du podium : 2 · 1 · 3
  const podium = [top3[1], top3[0], top3[2]];
  const heights = ["h-20", "h-28", "h-16"];
  const blockGrad = [
    "from-slate-300/80 to-slate-500/80",
    "from-amber-300 to-amber-500",
    "from-orange-300/80 to-orange-600/80",
  ];

  return (
    <div className="px-4 pt-8 flex flex-col gap-5">
      <div className="flex items-center justify-center relative">
        <Link
          href="/"
          className="absolute left-0 grid place-items-center w-9 h-9 rounded-full zh-card"
        >
          ←
        </Link>
        <h1 className="text-xl font-black">Leaderboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          onClick={() => setBoard("hiders")}
          className={`zh-btn py-3 ${board === "hiders" ? "zh-btn-violet" : "zh-btn-ghost"}`}
        >
          🫥 Top Hiders
        </button>
        <button
          onClick={() => setBoard("seekers")}
          className={`zh-btn py-3 ${board === "seekers" ? "zh-btn-primary" : "zh-btn-ghost"}`}
        >
          🔎 Top Seekers
        </button>
      </div>

      <div className="flex gap-2 text-xs items-center">
        {(
          [
            ["week", "This week"],
            ["all", "All-time"],
          ] as ["week" | "all", string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`rounded-full px-3.5 py-1.5 border transition ${
              period === k
                ? "border-white/70 bg-white/15 font-bold"
                : "border-white/15 text-white/55"
            }`}
          >
            {label}
          </button>
        ))}
        {period === "week" && (
          <span className="ml-auto text-white/35">resets Monday</span>
        )}
      </div>

      {loading ? (
        <div aria-label="Loading leaderboard">
          {/* Podium skeleton */}
          <div className="grid grid-cols-3 items-end gap-2 pt-2">
            {["h-20", "h-28", "h-16"].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
                <div className="w-[52px] h-[52px] rounded-full bg-white/10" />
                <div className="h-2.5 w-14 rounded bg-white/10" />
                <div className="h-2.5 w-6 rounded bg-white/10" />
                <div className={`w-full ${h} rounded-t-2xl bg-white/10`} />
              </div>
            ))}
          </div>

          {/* List skeleton */}
          <ol className="flex flex-col gap-2 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 border border-white/10 bg-white/5 animate-pulse"
              >
                <div className="w-6 h-2.5 rounded bg-white/10" />
                <div className="w-[38px] h-[38px] rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5 py-0.5">
                  <div className="h-2.5 w-2/5 rounded bg-white/10" />
                  <div className="h-2 w-1/3 rounded bg-white/10" />
                </div>
                <div className="h-2.5 w-6 rounded bg-white/10" />
              </li>
            ))}
          </ol>
        </div>
      ) : rows.length === 0 ? (
        <div className="zh-card p-8 text-center text-white/60">
          No one on the board yet. Go play!
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 items-end gap-2 pt-2">
            {podium.map((r, i) => {
              if (!r) return <div key={i} />;
              const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div key={r.player_id} className="flex flex-col items-center gap-2">
                  <div className="relative">
                    {rank === 1 && (
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl">👑</span>
                    )}
                    <Avatar
                      name={r.name}
                      size={rank === 1 ? 64 : 52}
                      className={rank === 1 ? "ring-2 ring-amber-300" : ""}
                    />
                  </div>
                  <p className="text-xs font-semibold text-center truncate max-w-[6rem]">
                    {r.name}
                    {r.player_id === me && <span className="text-amber-300"> (you)</span>}
                  </p>
                  <p className="text-[13px] font-black text-amber-300">{r.score}</p>
                  <div
                    className={`w-full ${heights[i]} rounded-t-2xl bg-gradient-to-b ${blockGrad[i]} grid place-items-center text-2xl font-black text-black/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]`}
                  >
                    {rank}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reste du classement */}
          <ol className="flex flex-col gap-2">
            {rest.map((r, i) => (
              <li
                key={r.player_id}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${
                  r.player_id === me
                    ? "bg-amber-400/15 border-amber-400/40"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <span className="w-6 text-center font-black text-white/50">{i + 4}</span>
                <Avatar name={r.name} size={38} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {r.name}
                    {r.player_id === me && <span className="text-amber-300 text-xs"> (you)</span>}
                  </p>
                  <p className="text-xs text-white/45">{sub(r)}</p>
                </div>
                <b className="text-amber-300">{r.score}</b>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
