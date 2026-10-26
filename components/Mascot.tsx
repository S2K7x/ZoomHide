// Petites mascottes vectorielles (aplat + visage kawaii), inspirées des
// maquettes « Tebak Gambar ». 100% SVG inline : aucun asset à charger, la
// couleur et l'humeur se règlent par props.

export type Mood = "happy" | "sad" | "wow" | "smirk";
export type MascotShape = "cat" | "blob" | "bean";

const BODY: Record<MascotShape, string> = {
  // carré à deux oreilles pointues
  cat: "M34 58 L44 22 L70 46 L90 46 L116 22 L126 58 L126 128 Q126 140 114 140 L46 140 Q34 140 34 128 Z",
  // gros galet arrondi
  blob: "M80 26 C122 26 136 52 136 90 C136 126 116 142 80 142 C44 142 24 126 24 90 C24 52 38 26 80 26 Z",
  // haricot large
  bean: "M18 92 C18 58 44 40 80 40 C116 40 142 58 142 92 C142 124 114 138 80 138 C46 138 18 124 18 92 Z",
};

function Brows({ mood }: { mood: Mood }) {
  const d =
    mood === "sad"
      ? ["M50 70 Q58 62 70 64", "M90 64 Q102 62 110 70"]
      : mood === "wow"
      ? ["M50 64 Q60 56 70 62", "M90 62 Q100 56 110 64"]
      : mood === "smirk"
      ? ["M50 68 Q60 64 70 68", "M90 62 Q100 58 110 64"]
      : ["M50 68 Q60 60 70 66", "M90 66 Q100 60 110 68"];
  return (
    <g fill="none" stroke="#161616" strokeWidth="4" strokeLinecap="round">
      <path d={d[0]} />
      <path d={d[1]} />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  if (mood === "happy")
    return (
      <g>
        <path d="M68 106 Q80 124 92 106 Z" fill="#161616" />
        <path d="M73 113 Q80 109 87 113 Q80 120 73 113 Z" fill="#ff5f7e" />
      </g>
    );
  if (mood === "wow")
    return (
      <g>
        <ellipse cx="80" cy="112" rx="7" ry="9" fill="#161616" />
        <ellipse cx="80" cy="116" rx="4.5" ry="3.5" fill="#ff5f7e" />
      </g>
    );
  if (mood === "sad")
    return (
      <path d="M71 114 Q80 105 89 114" fill="none" stroke="#161616" strokeWidth="4" strokeLinecap="round" />
    );
  return (
    <path d="M70 110 Q82 118 92 106" fill="none" stroke="#161616" strokeWidth="4" strokeLinecap="round" />
  );
}

export default function Mascot({
  color = "#ffd23f",
  shape = "cat",
  mood = "happy",
  size = 120,
  className = "",
}: {
  color?: string;
  shape?: MascotShape;
  mood?: Mood;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 160 160"
      className={className}
    >
      <path
        d={BODY[shape]}
        // via `style` : accepte aussi les variables CSS (var(--pink))
        style={{ fill: color, stroke: color }}
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <Brows mood={mood} />
      {/* yeux */}
      <ellipse cx="60" cy="88" rx="10" ry="12" fill="#161616" />
      <ellipse cx="100" cy="88" rx="10" ry="12" fill="#161616" />
      <circle cx="64" cy="83" r="3.6" fill="#fff" />
      <circle cx="104" cy="83" r="3.6" fill="#fff" />
      <circle cx="57" cy="94" r="1.6" fill="#fff" />
      <circle cx="97" cy="94" r="1.6" fill="#fff" />
      {/* joues */}
      <g>
        <ellipse cx="42" cy="106" rx="11" ry="6.5" fill="#ffb3cf" />
        <ellipse cx="118" cy="106" rx="11" ry="6.5" fill="#ffb3cf" />
        <g stroke="#161616" strokeWidth="1.8" strokeLinecap="round" opacity="0.7">
          <path d="M36 109 L39 103" />
          <path d="M41 109 L44 103" />
          <path d="M46 109 L49 103" />
          <path d="M112 109 L115 103" />
          <path d="M117 109 L120 103" />
          <path d="M122 109 L125 103" />
        </g>
      </g>
      <Mouth mood={mood} />
    </svg>
  );
}

// Étincelle à 4 branches, pour décorer les aplats.
export function Sparkle({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={className}>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="currentColor" />
    </svg>
  );
}
