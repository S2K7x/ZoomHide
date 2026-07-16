"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getPlayerId, getPlayerName, setPlayerName } from "@/lib/player";
import { compressImage } from "@/lib/image";
import { STICKERS, stickerDataUrl } from "@/lib/stickers";

type MyHide = {
  id: string;
  thumbnail_url: string;
  sticker_id: string;
  expires_at: string;
  total_attempts: number;
  finds: number;
};

export default function CreatePage() {
  const [loading, setLoading] = useState(true);
  const [myHide, setMyHide] = useState<MyHide | null>(null);
  const [name, setName] = useState("");

  // étape placement
  const [photo, setPhoto] = useState<{ blob: Blob; thumb: Blob; url: string } | null>(null);
  const [stickerId, setStickerId] = useState(STICKERS[0].id);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [size, setSize] = useState(8); // % de la largeur photo
  const [rotation, setRotation] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState("");

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
      setError("Impossible de lire cette image, essaie une autre photo.");
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

      const up1 = await supabase.storage
        .from("photos")
        .upload(`${base}.jpg`, photo.blob, { contentType: "image/jpeg" });
      if (up1.error) throw new Error(up1.error.message);
      const up2 = await supabase.storage
        .from("photos")
        .upload(`${base}_thumb.jpg`, photo.thumb, { contentType: "image/jpeg" });
      if (up2.error) throw new Error(up2.error.message);

      const photoUrl = supabase.storage.from("photos").getPublicUrl(`${base}.jpg`).data.publicUrl;
      const thumbUrl = supabase.storage.from("photos").getPublicUrl(`${base}_thumb.jpg`).data.publicUrl;

      const { data, error: rpcErr } = await supabase.rpc("create_hide", {
        p_creator_id: playerId,
        p_name: name || "Anonyme",
        p_photo_url: photoUrl,
        p_thumbnail_url: thumbUrl,
        p_sticker_id: stickerId,
        p_pos_x: pos.x,
        p_pos_y: pos.y,
        p_size_pct: size,
        p_rotation: rotation,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const res = data as { id?: string; error?: string };
      if (res.error === "already_active") {
        setError("Tu as déjà une cachette active ! Supprime-la d'abord.");
        await loadMyHide();
        return;
      }
      setPublishedId(res.id ?? "");
      setPhoto(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la publication.");
    } finally {
      setPublishing(false);
    }
  };

  const removeHide = async () => {
    if (!myHide) return;
    if (!confirm("Supprimer ta cachette active ?")) return;
    await supabase.rpc("delete_hide", {
      p_hide_id: myHide.id,
      p_creator_id: getPlayerId(),
    });
    setMyHide(null);
  };

  if (loading) {
    return <p className="p-8 text-center text-white/60">Chargement…</p>;
  }

  // ---- succès de publication ----
  if (publishedId) {
    return (
      <div className="px-6 pt-14 text-center flex flex-col gap-4">
        <h1 className="text-3xl font-black">🎉 Cachette publiée !</h1>
        <p className="text-white/70">
          Elle est jouable pendant 7 jours. Partage le lien du jeu en bio pour
          que tes followers la cherchent.
        </p>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.origin + "/play")}
          className="rounded-2xl bg-amber-400 text-black font-bold py-3"
        >
          📋 Copier le lien du jeu
        </button>
        <Link href="/play" className="text-violet-300 underline">
          Voir le feed des cachettes
        </Link>
      </div>
    );
  }

  // ---- déjà une cachette active ----
  if (myHide) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(myHide.expires_at).getTime() - Date.now()) / 86400000)
    );
    return (
      <div className="px-6 pt-10 flex flex-col gap-4">
        <h1 className="text-2xl font-black">Ta cachette active</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={myHide.thumbnail_url} alt="Ta cachette" className="rounded-2xl w-full" />
        <div className="rounded-2xl bg-white/5 p-4 text-sm space-y-1">
          <p>⏳ Expire dans <b>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</b></p>
          <p>🎯 {myHide.total_attempts} tentative{myHide.total_attempts > 1 ? "s" : ""}, {myHide.finds} trouvaille{myHide.finds > 1 ? "s" : ""}</p>
          <p className="text-white/60">
            Une seule cachette active à la fois. Supprime-la ou attends son
            expiration pour en publier une nouvelle.
          </p>
        </div>
        <button
          onClick={removeHide}
          className="rounded-2xl border border-red-400/50 text-red-300 font-semibold py-3"
        >
          🗑️ Supprimer cette cachette
        </button>
      </div>
    );
  }

  // ---- étape placement ----
  if (photo) {
    return (
      <div className="pt-4 flex flex-col gap-3">
        <h1 className="px-4 text-xl font-black">Place ton sticker</h1>
        <p className="px-4 text-sm text-white/60">
          Glisse le sticker là où il se fond le mieux dans le décor.
        </p>
        <div
          ref={photoRef}
          className="relative touch-none select-none"
          onPointerMove={moveSticker}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.url} alt="Ta photo" className="w-full" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stickerDataUrl(stickerId)}
            alt="Sticker"
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
          {STICKERS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStickerId(s.id)}
              className={`shrink-0 rounded-xl p-2 border ${
                s.id === stickerId ? "border-amber-400 bg-amber-400/20" : "border-white/10 bg-white/5"
              }`}
              title={s.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={stickerDataUrl(s.id)} alt={s.name} className="w-9 h-9" />
            </button>
          ))}
        </div>

        <div className="px-4 space-y-3 text-sm">
          <label className="block">
            Taille — {size.toFixed(0)}%
            <input
              type="range" min={3} max={25} step={0.5} value={size}
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
            Ton pseudo (pour le classement)
            <input
              type="text" value={name} maxLength={24}
              onChange={(e) => setName(e.target.value)}
              placeholder="Anonyme"
              className="mt-1 w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2"
            />
          </label>
        </div>

        {error && <p className="px-4 text-red-300 text-sm">{error}</p>}

        <div className="px-4 flex gap-2 pb-4">
          <button
            onClick={() => setPhoto(null)}
            className="flex-1 rounded-2xl border border-white/20 py-3 font-semibold"
          >
            ← Retour
          </button>
          <button
            onClick={publish}
            disabled={publishing}
            className="flex-[2] rounded-2xl bg-amber-400 text-black font-bold py-3 disabled:opacity-50"
          >
            {publishing ? "Publication…" : "Publier la cachette 🚀"}
          </button>
        </div>
      </div>
    );
  }

  // ---- étape upload ----
  return (
    <div className="px-6 pt-14 flex flex-col gap-5">
      <h1 className="text-3xl font-black">📸 Cacher un sticker</h1>
      <p className="text-white/70 text-sm">
        Choisis une photo de ta vraie vie : chambre, rue, bureau… Plus le décor
        est chargé, plus la cachette est vicieuse.
      </p>
      <label className="rounded-2xl bg-violet-500 text-center font-bold text-lg py-4 cursor-pointer active:scale-95 transition">
        Choisir une photo
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
        />
      </label>
      {error && <p className="text-red-300 text-sm">{error}</p>}
      <p className="rounded-2xl bg-white/5 p-4 text-xs text-white/60 leading-relaxed">
        🛡️ Pense à la vie privée : évite les visages reconnaissables, adresses,
        documents ou infos sensibles sur la photo. Elle sera visible par tous
        les joueurs pendant 7 jours.
      </p>
    </div>
  );
}
