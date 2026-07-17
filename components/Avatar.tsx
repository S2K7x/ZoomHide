// Avatar déterministe à partir du nom (dégradé + initiale) — pas d'upload
// d'image, reste gratuit et cohérent partout.
const GRADS = [
  ["#ffb56b", "#ff7e5f"],
  ["#6ee7b7", "#3b82f6"],
  ["#a78bfa", "#7c3aed"],
  ["#f472b6", "#db2777"],
  ["#fcd34d", "#f59e0b"],
  ["#5eead4", "#0ea5e9"],
  ["#fca5a5", "#ef4444"],
  ["#93c5fd", "#4f46e5"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Avatar({
  name,
  size = 40,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const [a, b] = GRADS[hash(name || "?") % GRADS.length];
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      className={`inline-grid place-items-center rounded-full font-black text-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(145deg, ${a}, ${b})`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 10px -4px rgba(0,0,0,0.6)",
      }}
    >
      {initial}
    </span>
  );
}
