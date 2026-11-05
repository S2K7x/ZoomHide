// Shared brand kit for marketing renders (mirrors components/Mascot.tsx, Logo.tsx, lib/stickers.ts)
window.BRAND = (() => {
  const BODY = {
    cat: "M34 58 L44 22 L70 46 L90 46 L116 22 L126 58 L126 128 Q126 140 114 140 L46 140 Q34 140 34 128 Z",
    blob: "M80 26 C122 26 136 52 136 90 C136 126 116 142 80 142 C44 142 24 126 24 90 C24 52 38 26 80 26 Z",
    bean: "M18 92 C18 58 44 40 80 40 C116 40 142 58 142 92 C142 124 114 138 80 138 C46 138 18 124 18 92 Z",
  };
  const brows = (m) => (m === "sad" ? ["M50 70 Q58 62 70 64", "M90 64 Q102 62 110 70"] : m === "wow" ? ["M50 64 Q60 56 70 62", "M90 62 Q100 56 110 64"] : m === "smirk" ? ["M50 68 Q60 64 70 68", "M90 62 Q100 58 110 64"] : ["M50 68 Q60 60 70 66", "M90 66 Q100 60 110 68"]);
  const mouth = (m) => m === "happy" ? `<path d="M68 106 Q80 124 92 106 Z" fill="#161616"/><path d="M73 113 Q80 109 87 113 Q80 120 73 113 Z" fill="#ff5f7e"/>`
    : m === "wow" ? `<ellipse cx="80" cy="112" rx="7" ry="9" fill="#161616"/><ellipse cx="80" cy="116" rx="4.5" ry="3.5" fill="#ff5f7e"/>`
    : m === "sad" ? `<path d="M71 114 Q80 105 89 114" fill="none" stroke="#161616" stroke-width="4" stroke-linecap="round"/>`
    : `<path d="M70 110 Q82 118 92 106" fill="none" stroke="#161616" stroke-width="4" stroke-linecap="round"/>`;
  const mascot = (shape = "cat", mood = "happy", color = "#ffd23f", size = 120, cls = "", style = "") => {
    const b = brows(mood);
    return `<svg class="${cls}" style="${style}" width="${size}" height="${size}" viewBox="0 0 160 160"><path d="${BODY[shape]}" fill="${color}" stroke="${color}" stroke-width="10" stroke-linejoin="round"/>
<g fill="none" stroke="#161616" stroke-width="4" stroke-linecap="round"><path d="${b[0]}"/><path d="${b[1]}"/></g>
<ellipse cx="60" cy="88" rx="10" ry="12" fill="#161616"/><ellipse cx="100" cy="88" rx="10" ry="12" fill="#161616"/>
<circle cx="64" cy="83" r="3.6" fill="#fff"/><circle cx="104" cy="83" r="3.6" fill="#fff"/><circle cx="57" cy="94" r="1.6" fill="#fff"/><circle cx="97" cy="94" r="1.6" fill="#fff"/>
<ellipse cx="42" cy="106" rx="11" ry="6.5" fill="#ffb3cf"/><ellipse cx="118" cy="106" rx="11" ry="6.5" fill="#ffb3cf"/>
<g stroke="#161616" stroke-width="1.8" stroke-linecap="round" opacity="0.7"><path d="M36 109 L39 103"/><path d="M41 109 L44 103"/><path d="M46 109 L49 103"/><path d="M112 109 L115 103"/><path d="M117 109 L120 103"/><path d="M122 109 L125 103"/></g>${mouth(mood)}</svg>`;
  };
  const sparkle = (size = 18, color = "#fff", cls = "", style = "") => `<svg class="${cls}" style="${style}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0 Z" fill="${color}"/></svg>`;
  const logoMark = (size = 40, rounded = true) => `<svg width="${size}" height="${size}" viewBox="0 0 48 48">${rounded ? '<rect width="48" height="48" rx="14" fill="#ffd23f"/>' : ""}<circle cx="21" cy="21" r="10.5" fill="#fff" stroke="#161616" stroke-width="4.5"/><path d="M29 29 L37 37" stroke="#161616" stroke-width="5.5" stroke-linecap="round"/><path d="M21 15.2 L22.6 19.4 L27 19.6 L23.6 22.4 L24.8 26.6 L21 24.2 L17.2 26.6 L18.4 22.4 L15 19.6 L19.4 19.4 Z" fill="#ff5f9e"/></svg>`;
  const shapeBody = (id, color) => {
    const f = `fill="${color}"`;
    switch (id) {
      case "square": return `<rect x="6" y="6" width="52" height="52" rx="6" ${f}/>`;
      case "rectangle": return `<rect x="4" y="20" width="56" height="24" rx="4" ${f}/>`;
      case "triangle": return `<polygon points="32,7 58,56 6,56" ${f}/>`;
      case "star": return `<polygon points="32,4 39,24 60,24 43,37 49,58 32,45 15,58 21,37 4,24 25,24" ${f}/>`;
      case "heart": return `<path d="M32 56 C8 40 4 24 14 14 C22 7 30 12 32 18 C34 12 42 7 50 14 C60 24 56 40 32 56 Z" ${f}/>`;
      case "diamond": return `<polygon points="32,4 58,32 32,60 6,32" ${f}/>`;
      case "hexagon": return `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" ${f}/>`;
      case "plus": return `<path d="M24 6 h16 v18 h18 v16 h-18 v18 h-16 v-18 h-18 v-16 h18 z" ${f}/>`;
      case "ring": return `<circle cx="32" cy="32" r="24" fill="none" stroke="${color}" stroke-width="11"/>`;
      default: return `<circle cx="32" cy="32" r="28" ${f}/>`;
    }
  };
  const shape = (id, color, size = 40, style = "") => `<svg style="${style}" width="${size}" height="${size}" viewBox="0 0 64 64">${shapeBody(id, color)}</svg>`;
  return { mascot, sparkle, logoMark, shape };
})();
