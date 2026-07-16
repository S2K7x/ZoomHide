// Formes simples, recolorables à la volée. La forme + la couleur sont des
// indices publics ; seule la POSITION reste secrète. Rendues en data-URL, donc
// utilisables aussi bien en <img> (DOM) qu'en <canvas> (image de partage).

export type Shape = { id: string; name: string };

export const SHAPES: Shape[] = [
  { id: "dot", name: "Dot" },
  { id: "square", name: "Square" },
  { id: "rectangle", name: "Rectangle" },
  { id: "triangle", name: "Triangle" },
  { id: "star", name: "Star" },
  { id: "heart", name: "Heart" },
  { id: "diamond", name: "Diamond" },
  { id: "hexagon", name: "Hexagon" },
  { id: "plus", name: "Plus" },
  { id: "ring", name: "Ring" },
];

export const DEFAULT_COLOR = "#f6c944";

function shapeBody(id: string, color: string): string {
  const f = `fill="${color}"`;
  switch (id) {
    case "square":
      return `<rect x="6" y="6" width="52" height="52" rx="6" ${f}/>`;
    case "rectangle":
      return `<rect x="4" y="20" width="56" height="24" rx="4" ${f}/>`;
    case "triangle":
      return `<polygon points="32,7 58,56 6,56" ${f}/>`;
    case "star":
      return `<polygon points="32,4 39,24 60,24 43,37 49,58 32,45 15,58 21,37 4,24 25,24" ${f}/>`;
    case "heart":
      return `<path d="M32 56 C8 40 4 24 14 14 C22 7 30 12 32 18 C34 12 42 7 50 14 C60 24 56 40 32 56 Z" ${f}/>`;
    case "diamond":
      return `<polygon points="32,4 58,32 32,60 6,32" ${f}/>`;
    case "hexagon":
      return `<polygon points="32,4 56,18 56,46 32,60 8,46 8,18" ${f}/>`;
    case "plus":
      return `<path d="M24 6 h16 v18 h18 v16 h-18 v18 h-16 v-18 h-18 v-16 h18 z" ${f}/>`;
    case "ring":
      return `<circle cx="32" cy="32" r="24" fill="none" stroke="${color}" stroke-width="11"/>`;
    case "dot":
    default:
      return `<circle cx="32" cy="32" r="28" ${f}/>`;
  }
}

export function shapeSvg(id: string, color: string = DEFAULT_COLOR): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${shapeBody(
    id,
    color
  )}</svg>`;
}

export function getShape(id: string): Shape {
  return SHAPES.find((s) => s.id === id) ?? SHAPES[0];
}

export function shapeDataUrl(id: string, color: string = DEFAULT_COLOR): string {
  return `data:image/svg+xml,${encodeURIComponent(shapeSvg(id, color))}`;
}

// Slider hue (0-360) + shade (0-100) -> hex. Saturation fixe pour rester
// intuitif tout en atteignant clair/foncé (utile pour se fondre dans la photo).
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
