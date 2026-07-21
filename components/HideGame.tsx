"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { shapeDataUrl, getShape, DEFAULT_COLOR, HINT_COLOR } from "@/lib/stickers";
import ZoomPanViewer from "@/components/ZoomPanViewer";
import RevealShare from "@/components/RevealShare";
import Avatar from "@/components/Avatar";

type Reveal = { pos_x: number; pos_y: number; size_pct: number; rotation: number };
type PastAttempt = { x: number; y: number; distance: number };

type Detail = {
  id: string;
  photo_url: string;
  sticker_id: string;
  sticker_color: string;
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

// Les tentatives se réinitialisent à minuit UTC côté serveur (`current_date`
// dans try_attempt/get_hide_detail). On calcule juste le temps restant côté
// client pour l'affichage, aucune nouvelle RPC.
function useResetCountdown(active: boolean) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const now = new Date();
      const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
      const diffMin = Math.max(0, Math.round((next - now.getTime()) / 60000));
      const h = Math.floor(diffMin / 60);
      const m = diffMin % 60;
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [active]);
  return label;
}

const ERRORS: Record<string, string> = {
  not_active: "This hide is no longer active.",
  own_hide: "This is your own hide 😄",
  already_found: "You already found it!",
  limit_reached: "No attempts left today. Come back tomorrow!",
  invalid_tap: "Invalid tap, try again.",
};

// Vue de jeu réutilisée par /play/[hideId] (public) et /play/private/[code].
// `backHref` : où renvoie la flèche retour selon le contexte.
export default function HideGame({
  hideId,
  backHref = "/play",
  backLabel = "Feed",
}: {
  hideId: string;
  backHref?: string;
  backLabel?: string;
}) {
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
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);

  const reveal: Reveal | null = result?.reveal ?? detail?.reveal ?? null;
  const found = result?.success || detail?.already_found;
  const attemptsLeft = result?.attempts_left ?? detail?.attempts_left ?? 0;
  const color = detail?.sticker_color ?? DEFAULT_COLOR;
  const resetLabel = useResetCountdown(!!detail && !detail.is_creator && !found && attemptsLeft === 0);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_hide_detail", {
      p_hide_id: hideId,
      p_player_id: getPlayerId(),
    });
    if (error) {
      setLoadError("Hide not found.");
      return;
    }
    const d = data as Detail;
    if (d.error) {
      setLoadError(ERRORS[d.error] ?? "Hide unavailable.");
      return;
    }
    setDetail(d);
    setPastAttempts([]);
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
      p_name: name || getPlayerName() || "Anonymous",
      p_tap_x: marker.x,
      p_tap_y: marker.y,
      p_time_ms: elapsed,
    });
    setSubmitting(false);
    if (error) {
      setFeedback("Network error, try again.");
      return;
    }
    const r = data as AttemptResult;
    if (r.error) {
      setFeedback(ERRORS[r.error] ?? r.error);
      if (r.error === "limit_reached") setResult({ attempts_left: 0 });
      return;
    }
    setResult(r);
    setTimeMs(elapsed);
    if (!r.success) {
      const d = r.distance ?? 100;
      setFeedback(
        d < 8 ? "🔥 Burning! So close…" :
        d < 18 ? "♨️ Hot, getting warmer." :
        d < 35 ? "🌤️ Lukewarm." : "🧊 Cold, look elsewhere."
      );
      setPastAttempts((prev) => [...prev, { x: marker.x, y: marker.y, distance: d }]);
    }
    setMarker(null);
  };

  // Couleur du repère selon la distance renvoyée par le serveur à cette
  // tentative — aide le joueur à mémoriser les zones déjà écartées sans
  // jamais révéler la position exacte.
  const heatColor = (d: number) =>
    d < 8 ? "border-rose-400 bg-rose-400/25" :
    d < 18 ? "border-orange-400 bg-orange-400/20" :
    d < 35 ? "border-yellow-300 bg-yellow-300/15" :
    "border-sky-400 bg-sky-400/15";

  if (loadError) {
    return (
      <div className="px-6 pt-20 text-center flex flex-col gap-4">
        <p className="text-lg">{loadError}</p>
        <Link href={backHref} className="text-violet-300 underline">← Back</Link>
      </div>
    );
  }
  if (!detail) {
    return <p className="p-8 text-center text-white/60">Loading…</p>;
  }

  const gameOver = found || (attemptsLeft === 0 && result != null) || detail.is_creator;

  return (
    <div className="flex flex-col gap-3 pt-4">
      <div className="px-4 flex items-center justify-between">
        <Link href={backHref} className="grid place-items-center w-9 h-9 rounded-full zh-card text-white/70">
          ←
        </Link>
        <div className="flex items-center gap-2 rounded-full zh-card px-3 py-1.5 text-sm">
          <span className="text-white/60">Find the</span>
          {/* silhouette neutre : on montre la FORME, jamais la couleur (l'indice
              couleur trahirait le camouflage) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shapeDataUrl(detail.sticker_id, HINT_COLOR)}
            alt={getShape(detail.sticker_id).name}
            className="w-5 h-5 opacity-90"
          />
          <span className="font-semibold">{getShape(detail.sticker_id).name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <Avatar name={detail.creator_name} size={22} />
          <span className="max-w-[4.5rem] truncate">{detail.creator_name}</span>
        </div>
      </div>

      <ZoomPanViewer
        src={detail.photo_url}
        className="w-full"
        onTap={(x, y) => {
          if (!gameOver && attemptsLeft > 0) setMarker({ x, y });
        }}
      >
        {pastAttempts.map((a, i) => (
          <div
            key={i}
            className={`absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 ${heatColor(a.distance)}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          />
        ))}
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
            This is your hide — the circle marks your shape. You can&apos;t play your own.
          </p>
        ) : found ? (
          <>
            <p className="text-center text-xl font-black text-amber-300">
              🎉 Found{result?.success ? ` in ${Math.round(timeMs / 1000)}s` : ""}!
            </p>
            {reveal && result?.success && (
              <RevealShare
                photoUrl={detail.photo_url}
                posX={reveal.pos_x}
                posY={reveal.pos_y}
                sizePct={reveal.size_pct}
                rotation={reveal.rotation}
                stickerId={detail.sticker_id}
                color={color}
                headline={`Found in ${Math.round(timeMs / 1000)}s!`}
                subline={`${getShape(detail.sticker_id).name} shape busted 🔎`}
              />
            )}
          </>
        ) : attemptsLeft === 0 ? (
          <p className="text-center text-white/80">
            😵 No attempts left today.
            {reveal
              ? " The shape was here 👆"
              : resetLabel
              ? ` Reset in ${resetLabel}.`
              : " Come back tomorrow!"}
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">
                Attempts left today:{" "}
                <b className="text-white">{"●".repeat(attemptsLeft)}{"○".repeat(3 - attemptsLeft)}</b>
              </span>
              <span className="text-white/50 text-xs">Pinch to zoom</span>
            </div>
            {feedback && <p className="text-center font-semibold">{feedback}</p>}
            {pastAttempts.length > 0 && (
              <p className="text-center text-xs text-white/40">
                Colored rings mark your past taps — 🧊 blue is cold, 🔥 red is close.
              </p>
            )}
            {askName && (
              <input
                type="text"
                value={name}
                maxLength={24}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="Your nickname for the leaderboard"
                className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2"
              />
            )}
            <button
              onClick={submitAttempt}
              disabled={!marker || submitting || (askName && !name.trim())}
              className="zh-btn zh-btn-primary py-3.5"
            >
              {submitting
                ? "Checking…"
                : marker
                ? askName && !name.trim()
                  ? "Enter a nickname to submit"
                  : "Submit this tap 🎯"
                : "Tap the photo to aim"}
            </button>
          </>
        )}

        <button
          onClick={() => setShowReport(true)}
          className="text-xs text-white/40 underline self-center"
        >
          🚩 Report this hide
        </button>
      </div>

      {showReport && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-6"
          onClick={() => !reportSubmitting && setShowReport(false)}
        >
          <div
            className="zh-card w-full max-w-sm p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {reportDone ? (
              <>
                <p className="text-center font-semibold">Thanks, the hide has been reported.</p>
                <button
                  onClick={() => {
                    setShowReport(false);
                    setReportDone(false);
                    setReportReason("");
                  }}
                  className="zh-btn zh-btn-primary py-2.5"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="font-semibold">Why report this hide?</p>
                <textarea
                  value={reportReason}
                  maxLength={280}
                  autoFocus
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Inappropriate photo, unclear shape, etc."
                  rows={3}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReport(false)}
                    disabled={reportSubmitting}
                    className="zh-btn zh-btn-ghost flex-1 py-2.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setReportSubmitting(true);
                      await supabase.rpc("report_hide", {
                        p_hide_id: hideId,
                        p_reporter_id: getPlayerId(),
                        p_reason: reportReason,
                      });
                      setReportSubmitting(false);
                      setReportDone(true);
                    }}
                    disabled={reportSubmitting || !reportReason.trim()}
                    className="zh-btn zh-btn-primary flex-1 py-2.5"
                  >
                    {reportSubmitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
