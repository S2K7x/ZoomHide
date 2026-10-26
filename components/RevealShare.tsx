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

      // Polices de l'app (next/font) : on attend qu'elles soient prêtes pour
      // que le canvas ne retombe pas sur la police système.
      await document.fonts?.ready;
      if (cancelled) return;
      const css = getComputedStyle(document.documentElement);
      const display = css.getPropertyValue("--font-bricolage").trim() || "system-ui";
      const sans = css.getPropertyValue("--font-jakarta").trim() || "system-ui";

      // fond crème + gros aplats colorés, comme l'app
      ctx.fillStyle = "#f3efe4";
      ctx.fillRect(0, 0, W, H);
      const blob = (x: number, y: number, r: number, c: string) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      };
      blob(980, 140, 260, "#ffd23f");
      blob(60, 1720, 300, "#77c4f1");
      blob(1040, 1560, 150, "#ff5f9e");

      // photo centrée, largeur ~92%
      const pw = W * 0.92;
      const ph = pw * (photo.naturalHeight / photo.naturalWidth);
      const px = (W - pw) / 2;
      const py = Math.max(300, (H - ph) / 2 - 80);
      // photo en carte arrondie, liseré blanc
      const rr = 56;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(px - 14, py - 14, pw + 28, ph + 28, rr + 14);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, rr);
      ctx.clip();
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
      glow.addColorStop(0, "rgba(255,210,63,0.6)");
      glow.addColorStop(1, "rgba(255,210,63,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, sw * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate((props.rotation * Math.PI) / 180);
      ctx.drawImage(sticker, -sw / 2, -sw / 2, sw, sw);
      ctx.restore();
      // anneau
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, sw * 0.9, 0, Math.PI * 2);
      ctx.stroke();

      // textes
      ctx.textAlign = "center";
      ctx.fillStyle = "#161616";
      ctx.font = `800 96px ${display}`;
      ctx.fillText("Zoom Hide", W / 2, 190);
      // titre dans une pilule noire
      ctx.font = `800 76px ${display}`;
      const hw = ctx.measureText(props.headline).width + 110;
      const hy = py + ph + 70;
      ctx.fillStyle = "#161616";
      ctx.beginPath();
      ctx.roundRect((W - hw) / 2, hy, hw, 130, 65);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(props.headline, W / 2, hy + 92);
      ctx.font = `600 44px ${sans}`;
      ctx.fillStyle = "rgba(22,22,22,0.8)";
      ctx.fillText(props.subline, W / 2, hy + 210);
      ctx.font = `700 40px ${sans}`;
      ctx.fillStyle = "#0f9d84";
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
      <div
        className="relative w-40 overflow-hidden rounded-2xl ring-4 ring-white shadow-lg"
        style={{ aspectRatio: "9 / 16" }}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          aria-label="Story preview"
        />
        {!ready && (
          <div
            aria-label="Generating preview"
            className="absolute inset-0 grid place-items-center zh-skeleton"
          >
            <span className="text-2xl opacity-30">📤</span>
          </div>
        )}
      </div>
      {ready && (
        <button
          onClick={share}
          className="zh-btn zh-btn-primary px-6 py-3.5"
        >
          Share to story 📤
        </button>
      )}
    </div>
  );
}
