"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";
import Avatar from "@/components/Avatar";
import Mascot from "@/components/Mascot";
import { BackIcon } from "@/components/Icons";

type Row = {
  name: string;
  // `is_me` est calculé côté serveur : le classement public ne renvoie plus
  // les `player_id`, qui servent de secret d'identité au reste du jeu.
  is_me: boolean;
  score: number;
  finds?: number;
  fails_caused?: number;
  perfect_hides?: number;
};

type MyRank = { rank: number; score: number } | null;

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
};

export default function LeaderboardPage() {
  const [board, setBoard] = useState<"hiders" | "seekers">("hiders");
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [myRank, setMyRank] = useState<MyRank>(null);

  const fetchBoard = async () => {
    setLoading(true);
    setMyRank(null);
    // `getPlayerId()` direct (lecture localStorage) : pas d'état à hydrater,
    // et l'id ne sert qu'à faire calculer `is_me` par le serveur.
    const playerId = getPlayerId();
    const { data, error: fetchError } = await supabase.rpc("get_leaderboard", {
      p_board: board,
      p_period: period,
      p_player_id: playerId,
    });
    if (fetchError) {
      setError(true);
      setLoading(false);
      return;
    }
    setError(false);
    const list = (data as Row[]) ?? [];
    setRows(list);
    setLoading(false);

    // Le top 50 ne suffit pas à situer un joueur classé plus loin — on ne
    // va chercher son rang exact que dans ce cas (pas de requête sinon).
    if (list.length > 0 && !list.some((r) => r.is_me)) {
      const { data: rankData } = await supabase.rpc("get_my_rank", {
        p_player_id: playerId,
        p_board: board,
        p_period: period,
      });
      setMyRank((rankData as MyRank) ?? null);
    }
  };

  useEffect(() => {
    fetchBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, period]);

  const sub = (r: Row) =>
    board === "hiders"
      ? `${r.fails_caused ?? 0} misses · ${r.perfect_hides ?? 0}💎`
      : `${r.finds ?? 0} found`;

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);
  // ordre visuel du podium : 2 · 1 · 3
  const podium = [top3[1], top3[0], top3[2]];
  const heights = ["h-28", "h-36", "h-24"];
  const blockColor = ["bg-sky", "bg-yellow", "bg-pink"];

  return (
    <div className="px-4 pt-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <h1 className="zh-display text-[2.8rem]">
          Leader
          <br />
          board
        </h1>
        <Link href="/" aria-label="Back to home" className="zh-icon-btn">
          <BackIcon size={20} />
        </Link>
      </div>

      <div className="zh-segment text-sm">
        <button onClick={() => setBoard("hiders")} aria-pressed={board === "hiders"}>
          🫥 Top Hiders
        </button>
        <button onClick={() => setBoard("seekers")} aria-pressed={board === "seekers"}>
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
            aria-pressed={period === k}
            className={`zh-chip ${period === k ? "zh-chip-on" : ""}`}
          >
            {label}
          </button>
        ))}
        {period === "week" && (
          <span className="ml-auto text-[var(--muted)] font-medium">resets Monday</span>
        )}
      </div>

      {loading ? (
        <div aria-label="Loading leaderboard">
          {/* Podium skeleton */}
          <div className="grid grid-cols-3 items-end gap-2 pt-2">
            {["h-28", "h-36", "h-24"].map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-[52px] h-[52px] rounded-full zh-skeleton" />
                <div className="h-2.5 w-14 rounded zh-skeleton" />
                <div className={`w-full ${h} rounded-[1.6rem] zh-skeleton`} />
              </div>
            ))}
          </div>

          {/* List skeleton */}
          <ol className="flex flex-col gap-2 mt-4 rounded-[2rem] bg-ink p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-full bg-white/10 px-3 py-2.5">
                <div className="w-[38px] h-[38px] rounded-full bg-white/15 shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5 py-0.5">
                  <div className="h-2.5 w-2/5 rounded bg-white/15" />
                  <div className="h-2 w-1/3 rounded bg-white/10" />
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : error ? (
        <div className="zh-card p-8 text-center flex flex-col items-center gap-3">
          <Mascot shape="bean" mood="sad" color="var(--sky)" size={96} />
          <p className="text-[var(--muted)]">Couldn&apos;t load the leaderboard. Check your connection.</p>
          <button onClick={fetchBoard} className="zh-btn zh-btn-primary px-5 py-2.5 text-sm">
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="zh-card p-8 text-center flex flex-col items-center gap-3">
          <Mascot shape="cat" mood="wow" color="var(--yellow)" size={96} />
          <p className="text-[var(--muted)]">No one on the board yet. Go play!</p>
          <Link href="/play" className="zh-btn zh-btn-primary px-5 py-2.5 text-sm">
            Find a hide
          </Link>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 items-end gap-2 pt-4">
            {podium.map((r, i) => {
              if (!r) return <div key={i} />;
              const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <p className="zh-display text-lg">{ordinal(rank)}</p>
                  <div className="relative">
                    {rank === 1 && (
                      <span className="absolute -top-4 -right-3 rotate-[20deg] text-2xl">👑</span>
                    )}
                    <Avatar name={r.name} size={rank === 1 ? 64 : 52} />
                  </div>
                  <p className="text-xs font-bold text-center truncate max-w-[6rem]">
                    {r.name}
                    {r.is_me && <span className="text-teal"> (you)</span>}
                  </p>
                  <div
                    className={`w-full ${heights[i]} rounded-[1.6rem] ${blockColor[i]} flex justify-center pt-3 shadow-[0_14px_26px_-18px_rgba(0,0,0,0.6)]`}
                  >
                    <span className="h-fit rounded-full bg-white px-2.5 py-1 text-xs font-extrabold">
                      {r.score} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reste du classement */}
          {rest.length > 0 && (
            <div className="rounded-[2rem] bg-ink p-3 pt-5">
              <h2 className="zh-display text-white text-2xl px-2 mb-3">Other ranks</h2>
              <ol className="flex flex-col gap-2">
                {rest.map((r, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-full pl-2 pr-5 py-2 ${
                      r.is_me ? "bg-sky" : "bg-white"
                    }`}
                  >
                    <Avatar name={r.name} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-ink/55 leading-tight">
                        {ordinal(i + 4)} · {sub(r)}
                      </p>
                      <p className="font-bold truncate">{r.is_me ? `${r.name} (you)` : r.name}</p>
                    </div>
                    <b className="zh-display text-xl">{r.score}</b>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {myRank && (
            <div className="flex items-center gap-3 rounded-full pl-4 pr-5 py-3 bg-sky shadow-[0_14px_26px_-18px_rgba(0,0,0,0.6)]">
              <span className="zh-display text-lg">#{myRank.rank}</span>
              <span className="flex-1 text-sm font-bold">You</span>
              <b className="zh-display text-xl">{myRank.score}</b>
            </div>
          )}
        </>
      )}
    </div>
  );
}
