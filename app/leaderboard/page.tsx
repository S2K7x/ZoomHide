"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getPlayerId } from "@/lib/player";

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

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <div className="px-4 pt-8 flex flex-col gap-4">
      <h1 className="text-2xl font-black">🏆 Classement</h1>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <button
          onClick={() => setBoard("hiders")}
          className={`rounded-xl py-2.5 font-bold ${
            board === "hiders" ? "bg-violet-500" : "bg-white/5 text-white/60"
          }`}
        >
          🫥 Top Cacheurs
        </button>
        <button
          onClick={() => setBoard("seekers")}
          className={`rounded-xl py-2.5 font-bold ${
            board === "seekers" ? "bg-amber-400 text-black" : "bg-white/5 text-white/60"
          }`}
        >
          🔎 Top Chercheurs
        </button>
      </div>

      <div className="flex gap-2 text-xs">
        {(
          [
            ["week", "Cette semaine"],
            ["all", "All-time"],
          ] as ["week" | "all", string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`rounded-full px-3 py-1.5 border ${
              period === k ? "border-white bg-white/15 font-bold" : "border-white/20 text-white/60"
            }`}
          >
            {label}
          </button>
        ))}
        {period === "week" && (
          <span className="ml-auto self-center text-white/40">reset chaque lundi</span>
        )}
      </div>

      {loading ? (
        <p className="text-center text-white/60 py-10">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-white/60 py-10">
          Personne au classement pour l&apos;instant. À toi de jouer !
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <li
              key={r.player_id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                r.player_id === me ? "bg-amber-400/15 border border-amber-400/40" : "bg-white/5"
              }`}
            >
              <span className="w-8 text-center font-bold">{medal(i)}</span>
              <span className="flex-1 truncate font-semibold">
                {r.name}
                {r.player_id === me && <span className="text-amber-300 text-xs"> (toi)</span>}
              </span>
              <span className="text-xs text-white/50">
                {board === "hiders"
                  ? `${r.fails_caused ?? 0} ratés · ${r.perfect_hides ?? 0}💎`
                  : `${r.finds ?? 0} trouvé${(r.finds ?? 0) > 1 ? "s" : ""}`}
              </span>
              <b className="text-amber-300">{r.score}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
