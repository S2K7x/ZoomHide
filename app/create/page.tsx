"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { compressImage, compositeSticker } from "@/lib/image";
import { SHAPES, shapeDataUrl, hslToHex } from "@/lib/stickers";

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
  const [shade, setShade] = useState(52); // lightness
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(8); // % of photo width
  const [rotation, setRotation] = useState(0);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState("");
  const [publishedCode, setPublishedCode] = useState<string | null>(null);

  const color = hslToHex(hue, 65, shade);
  const photoRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

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
      const link = `${window.location.origin}/play/private/${publishedCode}`;
      const pretty = `${publishedCode.slice(0, 3)} ${publishedCode.slice(3)}`;
      return (
        <div className="px-6 pt-14 text-center flex flex-col gap-4">
          <h1 className="text-3xl font-black">🔒 Private hide ready!</h1>
          <p className="text-white/70 text-sm">
            It won&apos;t show in the public feed. Only people with this code can
            play it. Share it in DMs or a close-friends story.
          </p>
          <div className="rounded-2xl bg-white/5 border border-white/10 py-5">
            <p className="text-xs uppercase tracking-widest text-white/50">Your code</p>
            <p className="text-4xl font-black tracking-[0.3em] mt-1">{pretty}</p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="rounded-2xl bg-amber-400 text-black font-bold py-3"
          >
            📋 Copy private link
          </button>
          <Link href={`/play/private/${publishedCode}`} className="text-violet-300 underline">
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
          className="rounded-2xl bg-amber-400 text-black font-bold py-3"
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
            <button
              onClick={() =>
                navigator.clipboard.writeText(
                  `${window.location.origin}/play/private/${myHide.code}`
                )
              }
              className="rounded-xl bg-amber-400 text-black font-bold py-2.5 text-sm"
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
          Drag the shape where it blends best. Match its color to the background.
        </p>
        <div
          ref={photoRef}
          className="relative touch-none select-none"
          onPointerMove={moveSticker}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Your photo" className="w-full" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shapeDataUrl(shapeId, color)}
            alt="Shape"
            draggable={false}
            onPointerDown={(e) => {
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
          <label className="block">
            Color
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
            Shade — {shade < 25 ? "dark" : shade > 75 ? "light" : "medium"}
            <input
              type="range" min={8} max={92} step={1} value={shade}
              onChange={(e) => setShade(Number(e.target.value))}
              className="w-full mt-1 h-3 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #000, ${hslToHex(hue, 65, 50)}, #fff)`,
              }}
            />
          </label>
          <label className="block">
            Size — {size.toFixed(0)}%
            <input
              type="range" min={3} max={30} step={0.5} value={size}
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
            className="flex-1 rounded-2xl border border-white/20 py-3 font-semibold"
          >
            ← Back
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="flex-[2] rounded-2xl bg-amber-400 text-black font-bold py-3 disabled:opacity-50"
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
      <label className="rounded-2xl bg-violet-500 text-center font-bold text-lg py-4 cursor-pointer active:scale-95 transition">
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
