"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { stickerDataUrl, getSticker } from "@/lib/stickers";
import ZoomPanViewer from "@/components/ZoomPanViewer";
import RevealShare from "@/components/RevealShare";

type Reveal = { pos_x: number; pos_y: number; size_pct: number; rotation: number };

type Detail = {
  id: string;
  photo_url: string;
  sticker_id: string;
  creator_name: string;
  is_creator: boolean;
  expires_at: string;
  attempts_today: number;
  attempts_left: number;
  already_found: boolean;
  reveal: Reveal | null;
  error?: string;
};

type AttemptResult = {
  success?: boolean;
  distance?: number;
  attempts_left?: number;
  reveal?: Reveal | null;
  error?: string;
};

const ERRORS: Record<string, string> = {
  not_active: "Cette cachette n'est plus active.",
  own_hide: "C'est ta propre cachette 😄",
  already_found: "Tu l'as déjà trouvée !",
  limit_reached: "Plus d'essais aujourd'hui. Reviens demain !",
  invalid_tap: "Tap invalide, réessaie.",
};

export default function HidePage({ params }: { params: Promise<{ hideId: string }> }) {
  const { hideId } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState("");
  const [timeMs, setTimeMs] = useState(0);
  const startTime = useRef(Date.now());

  const reveal: Reveal | null = result?.reveal ?? detail?.reveal ?? null;
  const found = result?.success || detail?.already_found;
  const attemptsLeft = result?.attempts_left ?? detail?.attempts_left ?? 0;

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hide_detail", {
      p_hide_id: hideId,
      p_player_id: getPlayerId(),
    });
    if (error) {
      setLoadError("Cachette introuvable.");
      return;
    }
    const d = data as Detail;
    if (d.error) {
      setLoadError(ERRORS[d.error] ?? "Cachette indisponible.");
      return;
    }
    setDetail(d);
    startTime.current = Date.now();
  }, [hideId]);

  useEffect(() => {
    setName(getPlayerName());
    load();
  }, [load]);

  const submitAttempt = async () => {
    if (!marker || submitting) return;
    if (!getPlayerName() && !name) {
      setAskName(true);
      return;
    }
    setSubmitting(true);
    setFeedback("");
    if (name) setPlayerName(name);
    const elapsed = Date.now() - startTime.current;
    const { data, error } = await supabase.rpc("try_attempt", {
      p_hide_id: hideId,
      p_player_id: getPlayerId(),
      p_name: name || getPlayerName() || "Anonyme",
      p_tap_x: marker.x,
      p_tap_y: marker.y,
      p_time_ms: elapsed,
    });
    setSubmitting(false);
    if (error) {
      setFeedback("Erreur réseau, réessaie.");
      return;
    }
    const r = data as AttemptResult;
    if (r.error) {
      setFeedback(ERRORS[r.error] ?? r.error);
      if (r.error === "limit_reached") setResult({ attempts_left: 0 });
      return;
    }
    setResult(r);
    setMarker(null);
    setTimeMs(elapsed);
    if (!r.success) {
      const d = r.distance ?? 100;
      setFeedback(
        d < 8 ? "🔥 Brûlant ! Tout près…" :
        d < 18 ? "♨️ Chaud, tu chauffes." :
        d < 35 ? "🌤️ Tiède." : "🧊 Froid, cherche ailleurs."
      );
    }
  };

  if (loadError) {
    return (
      <div className="px-6 pt-20 text-center flex flex-col gap-4">
        <p className="text-lg">{loadError}</p>
        <Link href="/play" className="text-violet-300 underline">← Retour au feed</Link>
      </div>
    );
  }
  if (!detail) {
    return <p className="p-8 text-center text-white/60">Chargement…</p>;
  }

  const gameOver = found || (attemptsLeft === 0 && result != null) || detail.is_creator;

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="px-4 flex items-center justify-between text-sm">
        <Link href="/play" className="text-white/60">← Feed</Link>
        <span>
          Cherche{" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stickerDataUrl(detail.sticker_id)}
            alt={getSticker(detail.sticker_id).name}
            className="inline w-6 h-6 align-middle mx-1"
          />
          <b>{getSticker(detail.sticker_id).name}</b>
        </span>
        <span className="text-white/60">par {detail.creator_name}</span>
      </div>

      <ZoomPanViewer
        src={detail.photo_url}
        className="w-full aspect-[3/4] max-h-[62dvh]"
        onTap={(x, y) => {
          if (!gameOver && attemptsLeft > 0) setMarker({ x, y });
        }}
      >
        {marker && (
          <div
            className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-amber-400 bg-amber-400/20"
            style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
          />
        )}
        {reveal && (
          <div
            className="absolute rounded-full border-[3px] border-amber-400 animate-pulse"
            style={{
              left: `${reveal.pos_x}%`,
              top: `${reveal.pos_y}%`,
              width: `${reveal.size_pct * 2}%`,
              aspectRatio: "1",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 30px 10px rgba(255,216,79,0.35)",
            }}
          />
        )}
      </ZoomPanViewer>

      <div className="px-4 flex flex-col gap-3 pb-6">
        {detail.is_creator ? (
          <p className="text-center text-white/70 text-sm">
            C&apos;est ta cachette — le cercle montre ton sticker. Tu ne peux pas jouer dessus.
          </p>
        ) : found ? (
          <>
            <p className="text-center text-xl font-black text-amber-300">
              🎉 Trouvé{result?.success ? ` en ${Math.round(timeMs / 1000)}s` : ""} !
            </p>
            {reveal && result?.success && (
              <RevealShare
                photoUrl={detail.photo_url}
                posX={reveal.pos_x}
                posY={reveal.pos_y}
                sizePct={reveal.size_pct}
                rotation={reveal.rotation}
                stickerId={detail.sticker_id}
                headline={`Trouvé en ${Math.round(timeMs / 1000)}s !`}
                subline={`Sticker ${getSticker(detail.sticker_id).name} débusqué 🔎`}
              />
            )}
          </>
        ) : attemptsLeft === 0 ? (
          <p className="text-center text-white/80">
            😵 Plus d&apos;essais aujourd&apos;hui.
            {reveal ? " Le sticker était là 👆" : " Reviens demain !"}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">
                Essais restants aujourd&apos;hui :{" "}
                <b className="text-white">{"●".repeat(attemptsLeft)}{"○".repeat(3 - attemptsLeft)}</b>
              </span>
              <span className="text-white/50 text-xs">Pince pour zoomer</span>
            </div>
            {feedback && <p className="text-center font-semibold">{feedback}</p>}
            {askName && (
              <input
                type="text"
                value={name}
                maxLength={24}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton pseudo pour le classement"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2"
              />
            )}
            <button
              onClick={submitAttempt}
              disabled={!marker || submitting || (askName && !name.trim())}
              className="rounded-2xl bg-amber-400 text-black font-bold py-3.5 disabled:opacity-40 active:scale-95 transition"
            >
              {submitting
                ? "Vérification…"
                : marker
                ? askName && !name.trim()
                  ? "Entre un pseudo pour valider"
                  : "Valider ce tap 🎯"
                : "Tape sur la photo pour viser"}
            </button>
          </>
        )}

        <button
          onClick={async () => {
            const reason = prompt("Pourquoi signaler cette cachette ?");
            if (reason === null) return;
            await supabase.rpc("report_hide", {
              p_hide_id: hideId,
              p_reporter_id: getPlayerId(),
              p_reason: reason,
            });
            alert("Merci, la cachette a été signalée.");
          }}
          className="text-xs text-white/40 underline self-center"
        >
          🚩 Signaler cette cachette
        </button>
      </div>
    </div>
  );
}
