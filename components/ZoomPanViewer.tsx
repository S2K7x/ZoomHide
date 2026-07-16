"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  src: string;
  onTap?: (xPct: number, yPct: number) => void;
  children?: ReactNode; // overlays positionnés en % dans l'espace image
  className?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;

// Zoom/pan/pinch avec Pointer Events natifs + détection de tap (mouvement < 8px,
// durée < 400ms). Les coordonnées de tap sont renvoyées en % de l'image.
export default function ZoomPanViewer({ src, onTap, children, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);

  const t = useRef({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startDist: number;
    startScale: number;
    startMid: { x: number; y: number };
    startT: { x: number; y: number };
    moved: number;
    startTime: number;
  } | null>(null);

  const apply = useCallback(() => {
    const c = containerRef.current;
    const el = contentRef.current;
    if (!c || !el) return;
    const s = t.current;
    const w = c.clientWidth;
    const h = c.clientHeight;
    // dimensions réelles du contenu (image à sa taille de layout, avant scale) :
    // on borne d'après elles, pas d'après le cadre, sinon un bord de photo plus
    // haute que le cadre resterait inatteignable au pan.
    const cw = el.offsetWidth || w;
    const ch = el.offsetHeight || h;
    s.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s.scale));
    const sw = cw * s.scale;
    const sh = ch * s.scale;
    // si le contenu est plus petit que le cadre sur un axe, on le centre ;
    // sinon on empêche juste qu'il ne laisse un vide.
    s.x = sw <= w ? (w - sw) / 2 : Math.min(0, Math.max(w - sw, s.x));
    s.y = sh <= h ? (h - sh) / 2 : Math.min(0, Math.max(h - sh, s.y));
    el.style.transform = `translate(${s.x}px, ${s.y}px) scale(${s.scale})`;
  }, []);

  const midAndDist = () => {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      return {
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        dist: Math.hypot(dx, dy),
      };
    }
    return { mid: { ...pts[0] }, dist: 0 };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { mid, dist } = midAndDist();
    gesture.current = {
      startDist: dist,
      startScale: t.current.scale,
      startMid: mid,
      startT: { x: t.current.x, y: t.current.y },
      moved: gesture.current?.moved ?? 0,
      startTime: gesture.current?.startTime ?? Date.now(),
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    const prev = pointers.current.get(e.pointerId)!;
    gesture.current.moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gesture.current;
    const { mid, dist } = midAndDist();
    if (pointers.current.size >= 2 && g.startDist > 0) {
      // pinch : zoom autour du point médian
      const ratio = dist / g.startDist;
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, g.startScale * ratio));
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = g.startMid.x - rect.left;
      const my = g.startMid.y - rect.top;
      const k = newScale / g.startScale;
      t.current.scale = newScale;
      t.current.x = mx - k * (mx - g.startT.x) + (mid.x - g.startMid.x);
      t.current.y = my - k * (my - g.startT.y) + (mid.y - g.startMid.y);
    } else {
      // pan
      t.current.x = g.startT.x + (mid.x - g.startMid.x);
      t.current.y = g.startT.y + (mid.y - g.startMid.y);
    }
    apply();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasTap =
      pointers.current.size === 1 &&
      gesture.current &&
      gesture.current.moved < 8 &&
      Date.now() - gesture.current.startTime < 400;

    if (wasTap && onTap && contentRef.current) {
      const rect = contentRef.current.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      if (xPct >= 0 && xPct <= 100 && yPct >= 0 && yPct <= 100) {
        onTap(xPct, yPct);
      }
    }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
    } else {
      // repartir proprement avec les pointeurs restants
      const { mid, dist } = midAndDist();
      gesture.current = {
        startDist: dist,
        startScale: t.current.scale,
        startMid: mid,
        startT: { x: t.current.x, y: t.current.y },
        moved: 999,
        startTime: 0,
      };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.current.scale * k));
    const kk = newScale / t.current.scale;
    t.current.x = mx - kk * (mx - t.current.x);
    t.current.y = my - kk * (my - t.current.y);
    t.current.scale = newScale;
    apply();
  };

  useEffect(() => {
    t.current = { x: 0, y: 0, scale: 1 };
    apply();
  }, [src, aspect, apply]);

  return (
    <div
      ref={containerRef}
      // le cadre épouse le ratio réel de la photo : plus aucun crop au repos.
      // Une photo très haute est plafonnée en hauteur mais reste entièrement
      // atteignable au pan (voir bornes dans apply()).
      style={{ aspectRatio: aspect ?? undefined, maxHeight: "72dvh" }}
      className={`relative overflow-hidden touch-none select-none bg-neutral-900 ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div ref={contentRef} className="origin-top-left will-change-transform">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Hide"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
            setLoaded(true);
          }}
          className="w-full h-auto pointer-events-none"
        />
        {loaded && (
          <div className="absolute inset-0 pointer-events-none">{children}</div>
        )}
      </div>
    </div>
  );
}
