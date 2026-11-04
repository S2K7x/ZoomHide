"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { compressImage, compositeSticker } from "@/lib/image";
import {
  SHAPES,
  shapeDataUrl,
  hslToHex,
  rgbToHsl,
  hexToRgb,
  COLOR_PRESETS,
} from "@/lib/stickers";
import Mascot, { Sparkle } from "@/components/Mascot";
import { BackIcon, CameraIcon } from "@/components/Icons";

type MyHide = {
  id: string;
  thumbnail_url: string;
  sticker_id: string;
  sticker_color: string;
  visibility: "public" | "private";
  code: string | null;
  expires_at: string;
  total_attempts: number;
  finds: number;
};

export default function CreatePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [myHide, setMyHide] = useState<MyHide | null>(null);
  const [name, setName] = useState("");

  // placement step
  const [photo, setPhoto] = useState<{ blob: Blob; thumb: Blob; url: string } | null>(null);
  const [shapeId, setShapeId] = useState(SHAPES[0].id);
  const [hue, setHue] = useState(48);
  const [sat, setSat] = useState(75); // saturation
  const [light, setLight] = useState(52); // lightness
  const [eyedrop, setEyedrop] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(9); // % of photo width (min 6 enforced)
  const [rotation, setRotation] = useState(0);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [publishing, setPublishing] = useState(false);
  // ratio réel de la photo : sert à plafonner le cadre en hauteur sans bandes
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState("");
  const [publishedCode, setPublishedCode] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Symétrique de copiedKey : le presse-papier a refusé pour CE bouton-là, on
  // retombe sur l'URL affichée en clair (failedUrl), copiable à la main.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const copyLink = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setFailedKey(null);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      setFailedUrl(text);
      setFailedKey(key);
    }
  };

  // Champ de repli, rendu sous le seul bouton dont la copie a échoué.
  const copyFallback = (key: string, label: string) =>
    failedKey === key ? (
      <div className="flex flex-col gap-1.5 text-left">
        <p className="text-xs text-[var(--muted)] text-center">
          Couldn&apos;t copy automatically — copy the link below.
        </p>
        <input
          type="text"
          readOnly
          autoFocus
          value={failedUrl}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="zh-input text-xs"
        />
      </div>
    ) : null;

  // Toujours pleinement opaque : le sticker doit rester visible à l'oeil nu,
  // seule sa couleur/forme peut le camoufler — pas sa transparence.
  const color = hslToHex(hue, sat, light);
  const photoRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const sampleCanvas = useRef<HTMLCanvasElement | null>(null);

  // canvas caché servant à la pipette (échantillonnage des pixels de la photo)
  useEffect(() => {
    if (!photo) {
      sampleCanvas.current = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      cv.getContext("2d")!.drawImage(img, 0, 0);
      sampleCanvas.current = cv;
    };
    img.src = photo.url;
  }, [photo]);

  const applyColorFromHex = (hex: string) => {
    const { r, g, b } = hexToRgb(hex);
    const hsl = rgbToHsl(r, g, b);
    setHue(hsl.h);
    setSat(hsl.s);
    setLight(hsl.l);
  };

  const sampleFromPhoto = (xPct: number, yPct: number) => {
    const cv = sampleCanvas.current;
    if (!cv) return;
    const px = Math.min(cv.width - 1, Math.max(0, Math.floor((xPct / 100) * cv.width)));
    const py = Math.min(cv.height - 1, Math.max(0, Math.floor((yPct / 100) * cv.height)));
    const [r, g, b] = cv.getContext("2d")!.getImageData(px, py, 1, 1).data;
    const hsl = rgbToHsl(r, g, b);
    setHue(hsl.h);
    setSat(hsl.s);
    setLight(hsl.l);
    setEyedrop(false);
  };

  // Un échec réseau ici ne doit PAS passer pour « aucune cachette active » :
  // l'écran d'upload s'afficherait, le joueur compresserait et téléverserait
  // deux images (photo + thumbnail) avant de se prendre `already_active` au
  // moment du `create_hide` — deux fichiers orphelins dans le bucket Storage
  // pour rien, et un message incompréhensible pour lui.
  const loadMyHide = useCallback(async () => {
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("get_my_active_hide", {
      p_creator_id: getPlayerId(),
    });
    if (rpcErr) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoadError(false);
    setMyHide(data as MyHide | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    setName(getPlayerName());
    loadMyHide();
  }, [loadMyHide]);

  const pickFile = async (file: File) => {
    setError("");
    try {
      const { photo: blob, thumbnail } = await compressImage(file);
      setPhoto({ blob, thumb: thumbnail, url: URL.createObjectURL(blob) });
      setPos({ x: 50, y: 50 });
    } catch {
      setError("Couldn't read this image, try another photo.");
    }
  };

  const moveSticker = (e: React.PointerEvent) => {
    if (!dragging.current || !photoRef.current) return;
    const rect = photoRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    });
  };

  const publish = async () => {
    if (!photo) return;
    setPublishing(true);
    setError("");
    try {
      const playerId = getPlayerId();
      setPlayerName(name);
      // Le chemin de stockage ne doit contenir AUCUN identifiant de joueur :
      // `photo_url` / `thumbnail_url` sont publics (feed `active_hides`, page
      // de jeu, partage), donc tout ce qui est dans le chemin est public aussi.
      // Le dossier était le `player_id` : il suffisait de lire une URL du feed
      // pour récupérer l'identité du créateur, et donc pouvoir supprimer sa
      // cachette (`delete_hide(hide_id, creator_id)` — les deux valeurs étaient
      // publiques) ou agir en son nom. Dossier par mois : lisible dans le
      // dashboard Storage, et la date de publication est déjà publique.
      const base = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}`;

      // On incruste le sticker dans la photo ET le thumbnail : le chercheur le
      // voit (camouflé), et la position n'est jamais transmise en clair.
      const stickerUrl = shapeDataUrl(shapeId, color);
      const placement = { posX: pos.x, posY: pos.y, sizePct: size, rotation };
      const [mainBlob, thumbBlob] = await Promise.all([
        compositeSticker(photo.blob, stickerUrl, placement, 0.82),
        compositeSticker(photo.thumb, stickerUrl, placement, 0.72),
      ]);

      const up1 = await supabase.storage
        .from("photos")
        .upload(`${base}.jpg`, mainBlob, { contentType: "image/jpeg" });
      if (up1.error) throw new Error(up1.error.message);
      const up2 = await supabase.storage
        .from("photos")
        .upload(`${base}_thumb.jpg`, thumbBlob, { contentType: "image/jpeg" });
      if (up2.error) throw new Error(up2.error.message);

      const photoUrl = supabase.storage.from("photos").getPublicUrl(`${base}.jpg`).data.publicUrl;
      const thumbUrl = supabase.storage.from("photos").getPublicUrl(`${base}_thumb.jpg`).data.publicUrl;

      const { data, error: rpcErr } = await supabase.rpc("create_hide", {
        p_creator_id: playerId,
        p_name: name || "Anonymous",
        p_photo_url: photoUrl,
        p_thumbnail_url: thumbUrl,
        p_sticker_id: shapeId,
        p_color: color,
        p_pos_x: pos.x,
        p_pos_y: pos.y,
        p_size_pct: size,
        p_rotation: rotation,
        p_visibility: visibility,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const res = data as { id?: string; code?: string | null; error?: string };
      if (res.error === "already_active") {
        setError("You already have an active hide! Delete it first.");
        await loadMyHide();
        return;
      }
      setPublishedId(res.id ?? "");
      setPublishedCode(res.code ?? null);
      setPhoto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while publishing.");
    } finally {
      setPublishing(false);
    }
  };

  // La suppression échouait en silence : la carte disparaissait de l'écran même
  // quand la requête n'était jamais partie, et le joueur se retrouvait bloqué
  // sur « You already have an active hide! » à la publication suivante.
  const removeHide = async () => {
    if (!myHide) return;
    setDeleting(true);
    setDeleteError("");
    const { data, error: rpcErr } = await supabase.rpc("delete_hide", {
      p_hide_id: myHide.id,
      p_creator_id: getPlayerId(),
    });
    setDeleting(false);
    if (rpcErr) {
      setDeleteError("Couldn't delete your hide. Check your connection and try again.");
      return;
    }
    setShowDeleteConfirm(false);
    // `not_found` = la cachette n'est déjà plus active (expirée entre-temps,
    // supprimée depuis un autre appareil) : on resynchronise sur le serveur
    // au lieu de supposer un état local.
    if ((data as { error?: string } | null)?.error) {
      await loadMyHide();
      return;
    }
    setMyHide(null);
  };

  if (loading) {
    return (
      <div role="status" aria-label="Loading" className="zh-page zh-page-mid pt-6 md:pt-10 flex flex-col gap-5">
        <div className="h-24 w-48 rounded-3xl zh-skeleton" />
        <div className="h-72 md:h-96 w-full rounded-[2rem] zh-skeleton" />
      </div>
    );
  }

  // `!photo` : si le joueur a déjà une photo en cours de placement (échec de
  // `loadMyHide` relancé après un `already_active`), on ne lui efface pas son
  // écran — le message d'erreur en ligne suffit.
  if (loadError && !photo) {
    return (
      <div className="zh-page zh-page-narrow pt-14">
        <div className="zh-card text-center py-8 px-6 flex flex-col items-center gap-3">
          <Mascot shape="bean" mood="sad" color="var(--sky)" size={96} />
          <p className="text-[var(--muted)]">Couldn&apos;t check your hides. Check your connection.</p>
          <button onClick={loadMyHide} className="zh-btn zh-btn-primary px-5 py-2.5 text-sm">
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ---- publish success ----
  if (publishedId) {
    if (publishedCode) {
      const link = `${window.location.origin}/play/private/${publishedId}`;
      const pretty = `${publishedCode.slice(0, 3)} ${publishedCode.slice(3)}`;
      return (
        <div className="zh-page zh-page-narrow pt-8 md:pt-12 text-center flex flex-col gap-4 zh-pop">
          <div className="zh-tile bg-purple text-white pt-6 pb-0 flex flex-col items-center">
            <Sparkle size={18} className="zh-twinkle absolute top-5 left-6 text-yellow" />
            <h1 className="zh-display text-4xl px-6">Private hide ready!</h1>
            <Mascot shape="blob" mood="smirk" color="var(--yellow)" size={130} className="zh-float -mb-6 mt-2" />
          </div>
          <p className="text-[var(--muted)] text-sm">
            It won&apos;t show in the public feed. Friends can either type the code
            at <b>{window.location.host}/play/private</b> or open your direct link.
          </p>
          <div className="zh-card py-5">
            <p className="text-xs uppercase tracking-widest font-bold text-[var(--muted)]">Your code</p>
            <p className="zh-display text-5xl tracking-[0.2em] mt-2">{pretty}</p>
          </div>
          <button
            onClick={() => copyLink("direct", link)}
            className="zh-btn zh-btn-primary py-4"
          >
            {copiedKey === "direct" ? "✅ Copied!" : "📋 Copy direct link (no code shown)"}
          </button>
          {copyFallback("direct", "Direct link to your private hide, copy it manually")}
          <Link href={`/play/private/${publishedId}`} className="zh-btn zh-btn-ghost py-3.5">
            Open the hide
          </Link>
        </div>
      );
    }
    return (
      <div className="zh-page zh-page-narrow pt-8 md:pt-12 text-center flex flex-col gap-4 zh-pop">
        <div className="zh-tile bg-lime pt-6 flex flex-col items-center">
          <Sparkle size={18} className="zh-twinkle absolute top-5 left-6 text-white" />
          <Sparkle size={12} className="zh-twinkle absolute top-16 right-8 text-white [animation-delay:1s]" />
          <h1 className="zh-display text-4xl px-6">Hide published!</h1>
          <Mascot shape="cat" mood="happy" color="var(--yellow)" size={140} className="zh-float -mb-6 mt-2" />
        </div>
        <p className="text-[var(--muted)]">
          It&apos;s playable for 7 days. Share the game link in your bio so your
          followers can hunt for it.
        </p>
        <button
          onClick={() => copyLink("game", window.location.origin + "/play")}
          className="zh-btn zh-btn-primary py-4"
        >
          {copiedKey === "game" ? "✅ Copied!" : "📋 Copy game link"}
        </button>
        {copyFallback("game", "Link to the hide feed, copy it manually")}
        <Link href="/play" className="zh-btn zh-btn-ghost py-3.5">
          See the hide feed
        </Link>
      </div>
    );
  }

  // ---- already an active hide ----
  if (myHide) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(myHide.expires_at).getTime() - Date.now()) / 86400000)
    );
    return (
      <div className="zh-page zh-page-mid pt-6 md:pt-10 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-x-12 lg:items-start">
        <h1 className="zh-display text-[2.8rem] md:text-[3.6rem] lg:col-start-2">
          Your
          <br className="md:hidden" /> active hide
        </h1>
        <div className="zh-tile bg-orange p-2 md:max-w-md md:w-full md:mx-auto lg:mx-0 lg:col-start-1 lg:row-start-1 lg:row-span-6 -rotate-[0.6deg]">
          <div className="relative overflow-hidden rounded-[1.5rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={myHide.thumbnail_url} alt="Your hide" className="w-full" />
          <span className="zh-badge absolute top-3 left-3 !text-xs !py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shapeDataUrl(myHide.sticker_id, myHide.sticker_color)} alt="" className="w-4 h-4" />
            hidden here
          </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center lg:col-start-2">
          <div className="zh-card !rounded-3xl py-3">
            <p className="zh-display text-2xl">{daysLeft}d</p>
            <p className="text-[11px] font-semibold text-[var(--muted)]">left</p>
          </div>
          <div className="zh-card !rounded-3xl py-3">
            <p className="zh-display text-2xl">{myHide.total_attempts}</p>
            <p className="text-[11px] font-semibold text-[var(--muted)]">
              attempt{myHide.total_attempts !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="zh-card !rounded-3xl py-3">
            <p className="zh-display text-2xl">{myHide.finds}</p>
            <p className="text-[11px] font-semibold text-[var(--muted)]">
              find{myHide.finds !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="zh-card p-4 text-sm space-y-1 lg:col-start-2">
          <p className="font-bold">{myHide.visibility === "private" ? "🔒 Private hide" : "🌍 Public hide"}</p>
          <p className="text-[var(--muted)]">
            Only one active hide at a time. Delete it or wait for it to expire to
            publish a new one.
          </p>
        </div>
        {myHide.visibility === "private" && myHide.code && (
          <div className="zh-tile bg-purple text-white p-5 text-center flex flex-col gap-2 lg:col-start-2">
            <p className="text-xs uppercase tracking-widest font-bold text-white/70">Private code</p>
            <p className="zh-display text-4xl tracking-[0.2em]">
              {myHide.code.slice(0, 3)} {myHide.code.slice(3)}
            </p>
            <p className="text-xs text-white/75">
              Share the code (friends type it in) or the direct link below.
            </p>
            <button
              onClick={() =>
                copyLink("private", `${window.location.origin}/play/private/${myHide.id}`)
              }
              className="zh-btn zh-btn-primary py-3 text-sm"
            >
              {copiedKey === "private" ? "✅ Copied!" : "📋 Copy private link"}
            </button>
            {copyFallback("private", "Private link to your hide, copy it manually")}
          </div>
        )}
        <button
          onClick={() => {
            setDeleteError("");
            setShowDeleteConfirm(true);
          }}
          className="zh-btn py-3.5 bg-white text-rose-600 shadow-[inset_0_0_0_1.5px_rgba(225,29,72,0.35)] lg:col-start-2"
        >
          🗑️ Delete this hide
        </button>

        {showDeleteConfirm && (
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-ink/50 backdrop-blur-sm px-6"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <div
              className="zh-card zh-pop w-full max-w-sm p-5 flex flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="zh-display text-2xl">Delete your active hide?</p>
              <p className="text-sm text-[var(--muted)]">
                This can&apos;t be undone. Attempts and finds on it will be lost.
              </p>
              {deleteError && <p className="text-sm font-semibold text-rose-600">⚠️ {deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="zh-btn zh-btn-ghost flex-1 py-2.5"
                >
                  Cancel
                </button>
                <button
                  onClick={removeHide}
                  disabled={deleting}
                  className="zh-btn flex-1 py-2.5 bg-rose-600 text-white"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---- placement step ----
  if (photo) {
    return (
      <div className="zh-page !px-0 md:!px-8 lg:!px-10 pt-6 md:pt-10 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-10 lg:gap-y-4 lg:items-start">
        <div className="px-4 md:px-0 flex flex-col gap-2 lg:col-start-1">
          <div className="flex items-center gap-3">
            <button onClick={() => setPhoto(null)} aria-label="Back to photo choice" className="zh-icon-btn shrink-0">
              <BackIcon size={20} />
            </button>
            <h1 className="zh-display text-3xl md:text-4xl">Place your shape</h1>
          </div>
          <p className="text-sm md:text-base text-[var(--muted)]">
            {eyedrop
              ? "🎨 Tap the photo to copy that exact color onto your shape."
              : "Drag the shape where it blends best. Play with color and size."}
          </p>
        </div>

        <div className="px-4 md:px-0 lg:col-start-1">
          <div
            ref={photoRef}
            className={`relative touch-none select-none overflow-hidden rounded-[2rem] ring-[5px] ring-white shadow-[0_20px_40px_-24px_rgba(0,0,0,0.6)] mx-auto ${eyedrop ? "cursor-crosshair" : ""}`}
            // - 6rem : le titre et la consigne occupent le haut de l'écran ici
            style={photoAspect ? { maxWidth: `calc((var(--zh-photo-max) - 6rem) * ${photoAspect})` } : undefined}
            onPointerMove={moveSticker}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            onPointerDown={(e) => {
              if (!eyedrop || !photoRef.current) return;
              const rect = photoRef.current.getBoundingClientRect();
              sampleFromPhoto(
                ((e.clientX - rect.left) / rect.width) * 100,
                ((e.clientY - rect.top) / rect.height) * 100
              );
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt="Your photo"
              className="w-full"
              draggable={false}
              onLoad={(e) => {
                const i = e.currentTarget;
                if (i.naturalWidth && i.naturalHeight) setPhotoAspect(i.naturalWidth / i.naturalHeight);
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shapeDataUrl(shapeId, color)}
              alt="Shape"
              draggable={false}
              onPointerDown={(e) => {
                if (eyedrop) return; // en mode pipette, on échantillonne au lieu de déplacer
                dragging.current = true;
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }}
              className="absolute cursor-grab active:cursor-grabbing"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${size}%`,
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
        <div className="px-4 md:px-0 flex gap-2 overflow-x-auto zh-noscroll pb-1 lg:flex-wrap lg:overflow-visible">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setShapeId(s.id)}
              aria-pressed={s.id === shapeId}
              className={`shrink-0 rounded-2xl p-2.5 transition-colors ${
                s.id === shapeId ? "bg-ink shadow-lg" : "bg-white shadow-[inset_0_0_0_1.5px_var(--line)] hover:bg-[#fafafa]"
              }`}
              title={s.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shapeDataUrl(s.id, color)} alt={s.name} className="w-9 h-9 lg:w-8 lg:h-8" />
            </button>
          ))}
        </div>

        <div className="mx-4 md:mx-0 zh-card p-4 md:p-5 space-y-4 text-sm font-semibold">
          {/* Pipette + aperçu de la couleur courante */}
          <div className="flex items-center gap-2">
            <span
              className="w-11 h-11 rounded-full ring-2 ring-white shadow-md shrink-0"
              style={{ backgroundColor: color }}
            />
            <button
              type="button"
              onClick={() => setEyedrop((v) => !v)}
              aria-pressed={eyedrop}
              className={`zh-btn flex-1 py-3 ${eyedrop ? "zh-btn-teal" : "zh-btn-ghost"}`}
            >
              🎨 {eyedrop ? "Tap the photo…" : "Pick color from photo"}
            </button>
          </div>

          {/* Presets de camouflage */}
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => applyColorFromHex(hex)}
                className="w-8 h-8 rounded-full ring-2 ring-white shadow-[0_0_0_3.5px_var(--line)] transition-transform hover:scale-110 active:scale-95"
                style={{ backgroundColor: hex }}
                title={hex}
                aria-label={`Use color ${hex}`}
              />
            ))}
          </div>

          <label className="block">
            Hue
            <input
              type="range" min={0} max={360} step={1} value={hue}
              onChange={(e) => setHue(Number(e.target.value))}
              className="zh-range mt-2"
              style={{
                background:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            />
          </label>
          <label className="block">
            Saturation <span className="text-[var(--muted)]">— {sat < 20 ? "muted / grey" : sat > 80 ? "vivid" : "medium"}</span>
            <input
              type="range" min={0} max={100} step={1} value={sat}
              onChange={(e) => setSat(Number(e.target.value))}
              className="zh-range mt-2"
              style={{
                background: `linear-gradient(to right, ${hslToHex(hue, 0, light)}, ${hslToHex(hue, 100, light)})`,
              }}
            />
          </label>
          <label className="block">
            Shade <span className="text-[var(--muted)]">— {light < 25 ? "dark" : light > 75 ? "light" : "medium"}</span>
            <input
              type="range" min={5} max={95} step={1} value={light}
              onChange={(e) => setLight(Number(e.target.value))}
              className="zh-range mt-2"
              style={{
                background: `linear-gradient(to right, #000, ${hslToHex(hue, sat, 50)}, #fff)`,
              }}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              Size <span className="text-[var(--muted)]">— {size.toFixed(0)}%</span>
              <input
                type="range" min={6} max={30} step={0.5} value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="zh-range mt-2"
              />
            </label>
            <label className="block">
              Rotation <span className="text-[var(--muted)]">— {rotation.toFixed(0)}°</span>
              <input
                type="range" min={-180} max={180} step={5} value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="zh-range mt-2"
              />
            </label>
          </div>
          {size <= 6.5 && (
            <p className="-mt-2 text-xs text-orange">Minimum size — keep it findable!</p>
          )}
          <label className="block">
            Your nickname <span className="text-[var(--muted)]">(for the leaderboard)</span>
            <input
              type="text" value={name} maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonymous"
              className="zh-input mt-1.5 font-medium"
            />
          </label>

          <div>
            <p className="mb-1.5">Who can play?</p>
            <div className="zh-segment">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                aria-pressed={visibility === "public"}
              >
                🌍 Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                aria-pressed={visibility === "private"}
              >
                🔒 Friends only
              </button>
            </div>
            <p className="mt-1.5 text-xs font-medium text-[var(--muted)]">
              {visibility === "public"
                ? "Shown in the public feed for everyone."
                : "Hidden from the feed. You get a 6-digit code to share."}
            </p>
          </div>
        </div>

        {error && <p className="px-4 md:px-0 text-rose-600 font-semibold text-sm">{error}</p>}

        <div className="px-4 md:px-0 flex gap-2 pb-4">
          <button
            onClick={() => setPhoto(null)}
            className="zh-btn zh-btn-ghost flex-1 py-4"
          >
            Back
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="zh-btn zh-btn-primary flex-[2] py-4"
          >
            {publishing ? "Publishing…" : "Publish hide 🚀"}
          </button>
        </div>
        </div>
      </div>
    );
  }

  // ---- upload step ----
  return (
    <div className="zh-page zh-page-mid pt-6 md:pt-10 flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-x-8 lg:gap-x-12 md:items-start">
      <div className="flex flex-col gap-5 md:col-start-1">
        <h1 className="zh-display text-[2.8rem] md:text-[3.6rem] lg:text-[4.4rem]">
          Hide a
          <br />
          Shape
        </h1>
        <ol className="hidden md:flex flex-col gap-3 text-[15px]">
          {[
            ["bg-yellow", "Pick a busy photo from your real life."],
            ["bg-pink", "Choose a shape and a color that blends in."],
            ["bg-lime", "Drag it into place and publish for 7 days."],
          ].map(([bg, t], i) => (
            <li key={t} className="flex items-center gap-3">
              <span aria-hidden="true" className={`grid place-items-center w-9 h-9 rounded-full ${bg} zh-display text-lg shrink-0`}>
                {i + 1}
              </span>
              <span className="text-[var(--muted)]">{t}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="zh-tile bg-sky h-[21rem] md:h-[24rem] lg:h-[26rem] md:col-start-2 md:row-start-1 md:row-span-2 md:rotate-[0.6deg]">
        <Sparkle size={20} className="zh-twinkle absolute top-5 left-5 text-white" />
        <Sparkle size={14} className="zh-twinkle absolute top-20 right-8 text-white [animation-delay:1.2s]" />
        <p className="zh-bubble absolute top-6 left-1/2 -translate-x-1/2 w-[82%] text-center text-sm font-semibold px-5 py-3">
          Pick a photo from your real life: bedroom, street, desk… The busier the
          scene, the sneakier the hide.
        </p>
        <Mascot
          shape="blob"
          mood="smirk"
          color="var(--purple)"
          size={200}
          className="zh-float absolute -bottom-10 -right-4"
        />
        <label className="zh-btn zh-btn-primary absolute bottom-5 left-5 z-10 px-6 py-4 text-base cursor-pointer focus-within:outline focus-within:outline-[2.5px] focus-within:outline-[var(--ring)] focus-within:outline-offset-2">
          <CameraIcon size={20} /> Choose a photo
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />
        </label>
      </div>
      {error && <p className="text-rose-600 font-semibold text-sm md:col-start-1">{error}</p>}
      <p className="zh-card p-4 text-xs text-[var(--muted)] leading-relaxed md:col-start-1">
        🛡️ Mind your privacy: avoid recognizable faces, addresses, documents or
        sensitive info in the photo. It will be visible to all players for 7 days.
      </p>
    </div>
  );
}
