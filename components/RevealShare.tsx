"use client";

import { useEffect, useRef, useState } from "react";
import { shapeDataUrl, DEFAULT_COLOR } from "@/lib/stickers";

type Props = {
  photoUrl: string;
  posX: number;
  posY: number;
  sizePct: number;
  rotation: number;
  stickerId: string;
  color?: string;
  headline: string; // e.g. "Found in 12s!"
  subline: string;
};

// Génère une image story 9:16 (1080x1920) 100% côté client avec <canvas> :
// photo + sticker en glow + score. Zéro traitement serveur.
export default function RevealShare(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      const load = (src: string, cors: boolean) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          if (cors) img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const [photo, sticker] = await Promise.all([
        load(props.photoUrl, true),
        load(shapeDataUrl(props.stickerId, props.color ?? DEFAULT_COLOR), false),
      ]);
      if (cancelled) return;

      const W = 1080;
      const H = 1920;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // fond dégradé
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#12081f");
      bg.addColorStop(1, "#2a1245");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // photo centrée, largeur ~92%
      const pw = W * 0.92;
      const ph = pw * (photo.naturalHeight / photo.naturalWidth);
      const px = (W - pw) / 2;
      const py = Math.max(300, (H - ph) / 2 - 80);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 40;
      ctx.drawImage(photo, px, py, pw, ph);
      ctx.restore();

      // sticker à sa vraie position, avec halo
      const sw = (props.sizePct / 100) * pw;
      const sx = px + (props.posX / 100) * pw;
      const sy = py + (props.posY / 100) * ph;
      ctx.save();
      ctx.translate(sx, sy);
      // halo
      const glow = ctx.createRadialGradient(0, 0, sw * 0.3, 0, 0, sw * 1.4);
      glow.addColorStop(0, "rgba(255,220,80,0.55)");
      glow.addColorStop(1, "rgba(255,220,80,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, sw * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate((props.rotation * Math.PI) / 180);
      ctx.drawImage(sticker, -sw / 2, -sw / 2, sw, sw);
      ctx.restore();
      // anneau
      ctx.strokeStyle = "#ffd84f";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, sw * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // textes
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 88px system-ui, sans-serif";
      ctx.fillText("🔎 Zoom Hide", W / 2, 160);
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.fillStyle = "#ffd84f";
      ctx.fillText(props.headline, W / 2, py + ph + 130);
      ctx.font = "44px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(props.subline, W / 2, py + ph + 200);
      ctx.font = "40px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("Come play too — link in bio", W / 2, H - 90);

      setReady(true);
    })().catch(() => setReady(false));

    return () => {
      cancelled = true;
    };
  }, [props]);

  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "zoomhide.jpg", { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Zoom Hide" });
          return;
        } catch {
          // partage annulé → fallback téléchargement
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "zoomhide-story.jpg";
      a.click();
      URL.revokeObjectURL(a.href);
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        className="w-40 rounded-xl border border-white/20"
        aria-label="Story preview"
      />
      {ready && (
        <button
          onClick={share}
          className="zh-btn zh-btn-primary !rounded-full px-6 py-3"
        >
          Share to story 📤
        </button>
      )}
    </div>
  );
}
