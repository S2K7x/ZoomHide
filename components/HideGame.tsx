"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { shapeDataUrl, getShape, DEFAULT_COLOR, HINT_COLOR } from "@/lib/stickers";
import ZoomPanViewer from "@/components/ZoomPanViewer";
import RevealShare from "@/components/RevealShare";
import Avatar from "@/components/Avatar";
import GameSkeleton from "@/components/GameSkeleton";
import Mascot, { Sparkle } from "@/components/Mascot";
import { BackIcon, FlagIcon, ShareIcon } from "@/components/Icons";

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

// Retour haptique léger sur mobile (Android Chrome — pas d'API équivalente sur
// iOS Safari, `navigator.vibrate` y est simplement absent). Repli silencieux
// si l'API n'existe pas ou lève une exception (permission, contexte, etc.).
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore, aucun repli nécessaire
    }
  }
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
// `backLabel` : nom de la destination, utilisé comme nom accessible de la
// flèche (« Back to the feed ») — le bouton n'affiche qu'un « ← », qui ne dit
// rien à un lecteur d'écran.
export default function HideGame({
  hideId,
  backHref = "/play",
  backLabel = "the feed",
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
  const [reportError, setReportError] = useState("");
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  // "failed" = le presse-papier a refusé : on retombe sur l'URL affichée en
  // clair, que le joueur copie à la main (shareUrl).
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const [shareUrl, setShareUrl] = useState("");

  const reveal: Reveal | null = result?.reveal ?? detail?.reveal ?? null;
  const found = result?.success || detail?.already_found;
  const attemptsLeft = result?.attempts_left ?? detail?.attempts_left ?? 0;
  const color = detail?.sticker_color ?? DEFAULT_COLOR;
  const resetLabel = useResetCountdown(!!detail && !detail.is_creator && !found && attemptsLeft === 0);

  const closeReport = useCallback(() => {
    setShowReport(false);
    setReportError("");
  }, []);

  useEffect(() => {
    if (!showReport || reportSubmitting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeReport();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showReport, reportSubmitting, closeReport]);

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
    if (r.success) {
      vibrate([15, 60, 15]);
    } else {
      const d = r.distance ?? 100;
      setFeedback(
        d < 8 ? "🔥 Burning! So close…" :
        d < 18 ? "♨️ Hot, getting warmer." :
        d < 35 ? "🌤️ Lukewarm." : "🧊 Cold, look elsewhere."
      );
      setPastAttempts((prev) => [...prev, { x: marker.x, y: marker.y, distance: d }]);
      vibrate(20);
    }
    setMarker(null);
  };

  // Partage le lien de CETTE cachette (utile pour défier des amis sur le
  // même hide) — juste l'URL courante, aucune donnée serveur en plus.
  const shareHide = async () => {
    if (!detail || typeof window === "undefined") return;
    const url = window.location.href;
    const shapeName = getShape(detail.sticker_id).name;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Zoom Hide", text: `Can you find the ${shapeName}?`, url });
        return;
      } catch (e) {
        // Feuille de partage fermée volontairement : ne rien afficher, le
        // joueur a déjà fait son choix. Tout autre échec (permission refusée,
        // contexte non sécurisé) retombe sur la copie presse-papier.
        if ((e as { name?: string } | null)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState((s) => (s === "copied" ? "idle" : s)), 1500);
    } catch {
      // Presse-papier indisponible ou refusé (iOS Safari hors geste direct,
      // contexte non sécurisé) : on montre l'URL, sélectionnée, à copier à la
      // main plutôt que de laisser le clic sans réponse.
      setShareUrl(url);
      setShareState("failed");
    }
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
      <div className="px-6 pt-16 flex flex-col items-center text-center gap-4">
        <Mascot shape="bean" mood="sad" color="var(--sky)" size={130} />
        <p className="zh-display text-3xl">{loadError}</p>
        <Link href={backHref} className="zh-btn zh-btn-primary px-6 py-3">
          <BackIcon size={18} /> Back to {backLabel}
        </Link>
      </div>
    );
  }
  if (!detail) {
    return <GameSkeleton />;
  }

  const gameOver = found || (attemptsLeft === 0 && result != null) || detail.is_creator;

  // Message annoncé aux lecteurs d'écran après chaque tentative. Le retour
  // visible (feedback, compteur, écran de fin) est `aria-hidden` : il est repris
  // mot pour mot ici, dans une région live montée une fois pour toutes, donc
  // rien n'est perdu en lecture au parcours et rien n'est lu deux fois.
  // Volontairement sans `resetLabel` (il change chaque minute : ça relancerait
  // une annonce en boucle) et sans le message du créateur (statique, présent dès
  // le premier rendu, donc déjà lu normalement).
  const liveMessage = detail.is_creator
    ? ""
    : found
    ? `Found${result?.success ? ` in ${Math.round(timeMs / 1000)} seconds` : ""}!`
    : attemptsLeft === 0
    ? `No attempts left today.${reveal ? " The shape is now circled on the photo." : " Come back tomorrow!"}`
    : `${feedback ? `${feedback} ` : ""}${attemptsLeft} ${attemptsLeft > 1 ? "attempts" : "attempt"} left today.`;

  return (
    <div className="flex flex-col gap-4 pt-5">
      <div className="px-4 flex items-center justify-between gap-2">
        {/* Lien icône seule : la flèche n'a pas de nom accessible, d'où
            l'`aria-label` construit sur la destination. */}
        <Link href={backHref} aria-label={`Back to ${backLabel}`} className="zh-icon-btn shrink-0">
          <BackIcon size={20} />
        </Link>
        <div className="zh-card !rounded-full flex items-center gap-2 pl-2 pr-4 py-1.5 text-sm min-w-0">
          {/* silhouette neutre : on montre la FORME, jamais la couleur (l'indice
              couleur trahirait le camouflage) */}
          <span className="grid place-items-center w-8 h-8 rounded-full bg-yellow shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shapeDataUrl(detail.sticker_id, HINT_COLOR)}
              alt={getShape(detail.sticker_id).name}
              className="w-5 h-5"
            />
          </span>
          <span className="text-[var(--muted)] shrink-0">Find the</span>
          <span className="font-bold truncate">{getShape(detail.sticker_id).name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
          <Avatar name={detail.creator_name} size={28} />
          <span className="max-w-[4.5rem] truncate">{detail.creator_name}</span>
        </div>
      </div>

      <div className="px-4">
        <div className="overflow-hidden rounded-[2rem] ring-[5px] ring-white shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)]">
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
                className="absolute w-9 h-9 -ml-[1.125rem] -mt-[1.125rem] rounded-full border-[3px] border-white bg-teal/35 shadow-[0_0_0_2px_rgba(0,0,0,0.35)]"
                style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
              />
            )}
            {reveal && (
              <div
                className="absolute rounded-full border-[3px] border-yellow animate-pulse"
                style={{
                  left: `${reveal.pos_x}%`,
                  top: `${reveal.pos_y}%`,
                  width: `${reveal.size_pct * 2}%`,
                  aspectRatio: "1",
                  transform: "translate(-50%, -50%)",
                  boxShadow: "0 0 30px 10px rgba(255,210,63,0.4)",
                }}
              />
            )}
          </ZoomPanViewer>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3 pb-6">
        <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {liveMessage}
        </p>
        {detail.is_creator ? (
          <div className="zh-tile bg-yellow p-5 flex items-center gap-4">
            <Mascot shape="cat" mood="smirk" color="var(--orange)" size={76} className="shrink-0" />
            <p className="text-sm font-semibold">
              This is your hide — the circle marks your shape. You can&apos;t play your own.
            </p>
          </div>
        ) : found ? (
          <div className="zh-tile zh-pop bg-teal text-white p-5 flex flex-col items-center gap-4">
            <Sparkle size={18} className="zh-twinkle absolute top-5 left-6 text-yellow" />
            <Sparkle size={12} className="zh-twinkle absolute top-14 right-8 text-white [animation-delay:1s]" />
            <Mascot shape="bean" mood="happy" color="var(--sky)" size={110} className="zh-float" />
            <p aria-hidden="true" className="zh-display text-4xl text-center">
              Found{result?.success ? ` in ${Math.round(timeMs / 1000)}s` : ""}!
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
          </div>
        ) : attemptsLeft === 0 ? (
          <div aria-hidden="true" className="zh-tile zh-pop bg-pink p-5 flex items-center gap-4">
            <Mascot shape="cat" mood="sad" color="var(--yellow)" size={84} className="shrink-0" />
            <div>
              <p className="zh-display text-2xl">Out of tries!</p>
              <p className="text-sm font-medium text-ink/75 mt-1">
                {reveal
                  ? "The shape was here 👆"
                  : resetLabel
                  ? `New tries in ${resetLabel}.`
                  : "Come back tomorrow!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="zh-card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-sm" aria-hidden="true">
              <div className="flex-1 flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-2.5 flex-1 rounded-full transition-colors ${
                      i < attemptsLeft ? "bg-orange" : "bg-ink/10"
                    }`}
                  />
                ))}
              </div>
              <span className="font-bold whitespace-nowrap">
                {attemptsLeft} {attemptsLeft > 1 ? "tries" : "try"} left
              </span>
            </div>
            {feedback ? (
              <p
                aria-hidden="true"
                key={feedback + pastAttempts.length}
                className="zh-pop rounded-2xl bg-purple text-white text-center font-bold py-3 px-4"
              >
                {feedback}
              </p>
            ) : (
              <p className="text-center text-sm text-[var(--muted)]">
                Pinch or scroll to zoom · tap where it hides
              </p>
            )}
            {pastAttempts.length > 0 && (
              <p className="text-center text-xs text-[var(--muted)]">
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
                className="zh-input"
              />
            )}
            <button
              onClick={submitAttempt}
              disabled={!marker || submitting || (askName && !name.trim())}
              className="zh-btn zh-btn-primary py-4 text-base"
            >
              {submitting
                ? "Checking…"
                : marker
                ? askName && !name.trim()
                  ? "Enter a nickname to submit"
                  : "Submit this tap 🎯"
                : "Tap the photo to aim"}
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <button onClick={shareHide} className="zh-btn zh-btn-ghost px-4 py-2 text-xs">
              {shareState === "copied" ? (
                "✓ Link copied!"
              ) : (
                <>
                  <ShareIcon size={15} /> Share this hide
                </>
              )}
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="zh-btn zh-btn-ghost px-4 py-2 text-xs"
            >
              <FlagIcon size={15} /> Report
            </button>
          </div>
          {shareState === "failed" && (
            <div className="w-full flex flex-col gap-1.5">
              <p className="text-xs text-[var(--muted)] text-center">
                Couldn&apos;t copy automatically — copy the link below.
              </p>
              <input
                type="text"
                readOnly
                autoFocus
                value={shareUrl}
                aria-label="Link to this hide, copy it manually"
                onFocus={(e) => e.currentTarget.select()}
                className="zh-input text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 backdrop-blur-sm px-6"
          onClick={() => !reportSubmitting && closeReport()}
        >
          <div
            className="zh-card zh-pop w-full max-w-sm p-5 flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {reportDone ? (
              <>
                <p className="text-center font-bold">Thanks, the hide has been reported.</p>
                <button
                  onClick={() => {
                    closeReport();
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
                <p className="zh-display text-2xl">Why report this hide?</p>
                <textarea
                  value={reportReason}
                  maxLength={280}
                  autoFocus
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Inappropriate photo, unclear shape, etc."
                  rows={3}
                  className="zh-input text-sm resize-none"
                />
                {reportError && (
                  <p role="alert" className="text-sm font-semibold text-rose-600">{reportError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={closeReport}
                    disabled={reportSubmitting}
                    className="zh-btn zh-btn-ghost flex-1 py-2.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setReportSubmitting(true);
                      setReportError("");
                      // On lit l'`error` renvoyé par Supabase : sans ça, une
                      // coupure réseau affichait quand même « Thanks, the hide
                      // has been reported » alors qu'aucune ligne `reports`
                      // n'était créée.
                      const { error } = await supabase.rpc("report_hide", {
                        p_hide_id: hideId,
                        p_reporter_id: getPlayerId(),
                        p_reason: reportReason,
                      });
                      setReportSubmitting(false);
                      if (error) {
                        setReportError("Couldn't send the report. Check your connection and try again.");
                        return;
                      }
                      setReportDone(true);
                    }}
                    disabled={reportSubmitting || !reportReason.trim()}
                    className="zh-btn zh-btn-primary flex-1 py-2.5"
                  >
                    {reportSubmitting ? "Sending…" : reportError ? "Retry" : "Send"}
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
