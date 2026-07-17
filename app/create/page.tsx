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
  alphaHex,
  rgbToHsl,
  hexToRgb,
  COLOR_PRESETS,
} from "@/lib/stickers";

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
  const [myHide, setMyHide] = useState<MyHide | null>(null);
  const [name, setName] = useState("");

  // placement step
  const [photo, setPhoto] = useState<{ blob: Blob; thumb: Blob; url: string } | null>(null);
  const [shapeId, setShapeId] = useState(SHAPES[0].id);
  const [hue, setHue] = useState(48);
  const [sat, setSat] = useState(75); // saturation
  const [light, setLight] = useState(52); // lightness
  const [alpha, setAlpha] = useState(1); // opacité
  const [eyedrop, setEyedrop] = useState(false);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(9); // % of photo width (min 6 enforced)
  const [rotation, setRotation] = useState(0);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState("");
  const [publishedCode, setPublishedCode] = useState<string | null>(null);

  const baseColor = hslToHex(hue, sat, light);
  const color = alpha >= 1 ? baseColor : baseColor + alphaHex(alpha);
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

  const loadMyHide = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_my_active_hide", {
      p_creator_id: getPlayerId(),
    });
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
      const base = `${playerId}/${crypto.randomUUID()}`;

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

  const removeHide = async () => {
    if (!myHide) return;
    if (!confirm("Delete your active hide?")) return;
    await supabase.rpc("delete_hide", {
      p_hide_id: myHide.id,
      p_creator_id: getPlayerId(),
    });
    setMyHide(null);
  };

  if (loading) {
    return <p className="p-8 text-center text-white/60">Loading…</p>;
  }

  // ---- publish success ----
  if (publishedId) {
    if (publishedCode) {
      const link = `${window.location.origin}/play/private/${publishedId}`;
      const pretty = `${publishedCode.slice(0, 3)} ${publishedCode.slice(3)}`;
      return (
        <div className="px-6 pt-14 text-center flex flex-col gap-4">
          <h1 className="text-3xl font-black">🔒 Private hide ready!</h1>
          <p className="text-white/70 text-sm">
            It won&apos;t show in the public feed. Friends can either type the code
            at <b>{window.location.host}/play/private</b> or open your direct link.
          </p>
          <div className="rounded-2xl bg-white/5 border border-white/10 py-5">
            <p className="text-xs uppercase tracking-widest text-white/50">Your code</p>
            <p className="text-4xl font-black tracking-[0.3em] mt-1">{pretty}</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="zh-btn zh-btn-primary py-3"
          >
            📋 Copy direct link (no code shown)
          </button>
          <Link href={`/play/private/${publishedId}`} className="text-violet-300 underline">
            Open the hide
          </Link>
        </div>
      );
    }
    return (
      <div className="px-6 pt-14 text-center flex flex-col gap-4">
        <h1 className="text-3xl font-black">🎉 Hide published!</h1>
        <p className="text-white/70">
          It&apos;s playable for 7 days. Share the game link in your bio so your
          followers can hunt for it.
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.origin + "/play")}
          className="zh-btn zh-btn-primary py-3"
        >
          📋 Copy game link
        </button>
        <Link href="/play" className="text-violet-300 underline">
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
      <div className="px-6 pt-10 flex flex-col gap-4">
        <h1 className="text-2xl font-black">Your active hide</h1>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={myHide.thumbnail_url} alt="Your hide" className="rounded-2xl w-full" />
          <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-1 flex items-center gap-1.5 text-xs">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shapeDataUrl(myHide.sticker_id, myHide.sticker_color)} alt="" className="w-4 h-4" />
            hidden here
          </span>
        </div>
        <div className="rounded-2xl bg-white/5 p-4 text-sm space-y-1">
          <p>{myHide.visibility === "private" ? "🔒 Private" : "🌍 Public"}</p>
          <p>⏳ Expires in <b>{daysLeft} day{daysLeft > 1 ? "s" : ""}</b></p>
          <p>🎯 {myHide.total_attempts} attempt{myHide.total_attempts !== 1 ? "s" : ""}, {myHide.finds} find{myHide.finds !== 1 ? "s" : ""}</p>
          <p className="text-white/60">
            Only one active hide at a time. Delete it or wait for it to expire to
            publish a new one.
          </p>
        </div>
        {myHide.visibility === "private" && myHide.code && (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/50">Private code</p>
            <p className="text-3xl font-black tracking-[0.3em]">
              {myHide.code.slice(0, 3)} {myHide.code.slice(3)}
            </p>
            <p className="text-xs text-white/50">
              Share the code (friends type it in) or the direct link below.
            </p>
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `${window.location.origin}/play/private/${myHide.id}`
                )
              }
              className="zh-btn zh-btn-primary py-2.5 text-sm"
            >
              📋 Copy private link
            </button>
          </div>
        )}
        <button
          onClick={removeHide}
          className="rounded-2xl border border-red-400/50 text-red-300 font-semibold py-3"
        >
          🗑️ Delete this hide
        </button>
      </div>
    );
  }

  // ---- placement step ----
  if (photo) {
    return (
      <div className="pt-4 flex flex-col gap-3">
        <h1 className="px-4 text-xl font-black">Place your shape</h1>
        <p className="px-4 text-sm text-white/60">
          {eyedrop
            ? "🎨 Tap the photo to copy that exact color onto your shape."
            : "Drag the shape where it blends best. Play with color, opacity and size."}
        </p>
        <div
          ref={photoRef}
          className={`relative touch-none select-none ${eyedrop ? "cursor-crosshair" : ""}`}
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
          <img src={photo.url} alt="Your photo" className="w-full" draggable={false} />
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

        <div className="px-4 flex gap-2 overflow-x-auto pb-1">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setShapeId(s.id)}
              className={`shrink-0 rounded-xl p-2 border ${
                s.id === shapeId ? "border-amber-400 bg-amber-400/20" : "border-white/10 bg-white/5"
              }`}
              title={s.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shapeDataUrl(s.id, color)} alt={s.name} className="w-9 h-9" />
            </button>
          ))}
        </div>

        <div className="px-4 space-y-3 text-sm">
          {/* Pipette + aperçu de la couleur courante */}
          <div className="flex items-center gap-2">
            <span
              className="w-9 h-9 rounded-lg border border-white/20 shrink-0"
              style={{
                backgroundColor: color,
                backgroundImage:
                  "linear-gradient(45deg,#666 25%,transparent 25%,transparent 75%,#666 75%),linear-gradient(45deg,#666 25%,#444 25%,#444 75%,#666 75%)",
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0,5px 5px",
              }}
            >
              <span className="block w-full h-full rounded-lg" style={{ backgroundColor: color }} />
            </span>
            <button
              type="button"
              onClick={() => setEyedrop((v) => !v)}
              className={`flex-1 rounded-xl py-2.5 font-bold ${
                eyedrop ? "bg-amber-400 text-black" : "bg-white/10 text-white/80"
              }`}
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
                className="w-7 h-7 rounded-full border border-white/25"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>

          <label className="block">
            Hue
            <input
              type="range" min={0} max={360} step={1} value={hue}
              onChange={(e) => setHue(Number(e.target.value))}
              className="w-full mt-1 h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background:
                  "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
              }}
            />
          </label>
          <label className="block">
            Saturation — {sat < 20 ? "muted / grey" : sat > 80 ? "vivid" : "medium"}
            <input
              type="range" min={0} max={100} step={1} value={sat}
              onChange={(e) => setSat(Number(e.target.value))}
              className="w-full mt-1 h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, ${hslToHex(hue, 0, light)}, ${hslToHex(hue, 100, light)})`,
              }}
            />
          </label>
          <label className="block">
            Shade — {light < 25 ? "dark" : light > 75 ? "light" : "medium"}
            <input
              type="range" min={5} max={95} step={1} value={light}
              onChange={(e) => setLight(Number(e.target.value))}
              className="w-full mt-1 h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #000, ${hslToHex(hue, sat, 50)}, #fff)`,
              }}
            />
          </label>
          <label className="block">
            Opacity — {Math.round(alpha * 100)}%
            <input
              type="range" min={0.15} max={1} step={0.05} value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
              className="w-full mt-1 h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, transparent, ${baseColor}), repeating-conic-gradient(#666 0% 25%, #444 0% 50%) 0 0 / 12px 12px`,
              }}
            />
          </label>
          <label className="block">
            Size — {size.toFixed(0)}%{size <= 6.5 && <span className="text-amber-300"> (min — keep it findable!)</span>}
            <input
              type="range" min={6} max={30} step={0.5} value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </label>
          <label className="block">
            Rotation — {rotation.toFixed(0)}°
            <input
              type="range" min={-180} max={180} step={5} value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </label>
          <label className="block">
            Your nickname (for the leaderboard)
            <input
              type="text" value={name} maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonymous"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2"
            />
          </label>

          <div>
            <p className="mb-1">Who can play?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`rounded-xl py-2.5 font-bold text-sm ${
                  visibility === "public" ? "bg-amber-400 text-black" : "bg-white/5 text-white/60"
                }`}
              >
                🌍 Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={`rounded-xl py-2.5 font-bold text-sm ${
                  visibility === "private" ? "bg-violet-500" : "bg-white/5 text-white/60"
                }`}
              >
                🔒 Friends only
              </button>
            </div>
            <p className="mt-1.5 text-xs text-white/50">
              {visibility === "public"
                ? "Shown in the public feed for everyone."
                : "Hidden from the feed. You get a 6-digit code to share."}
            </p>
          </div>
        </div>

        {error && <p className="px-4 text-red-300 text-sm">{error}</p>}

        <div className="px-4 flex gap-2 pb-4">
          <button
            onClick={() => setPhoto(null)}
            className="zh-btn zh-btn-ghost flex-1 py-3.5"
          >
            ← Back
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="zh-btn zh-btn-primary flex-[2] py-3.5"
          >
            {publishing ? "Publishing…" : "Publish hide 🚀"}
          </button>
        </div>
      </div>
    );
  }

  // ---- upload step ----
  return (
    <div className="px-6 pt-14 flex flex-col gap-5">
      <h1 className="text-3xl font-black">📸 Hide a shape</h1>
      <p className="text-white/70 text-sm">
        Pick a photo from your real life: bedroom, street, desk… The busier the
        scene, the sneakier the hide.
      </p>
      <label className="zh-btn zh-btn-violet text-center text-lg py-4 cursor-pointer">
        Choose a photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />
      </label>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <p className="rounded-2xl bg-white/5 p-4 text-xs text-white/60 leading-relaxed">
        🛡️ Mind your privacy: avoid recognizable faces, addresses, documents or
        sensitive info in the photo. It will be visible to all players for 7 days.
      </p>
    </div>
  );
}
