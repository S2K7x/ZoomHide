// Banque de stickers SVG inline. Rendus via data-URL, donc utilisables à la
// fois en <img> (placement DOM) et en canvas (image de partage).

export type Sticker = { id: string; name: string; svg: string };

const S = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

export const STICKERS: Sticker[] = [
  {
    id: "ladybug",
    name: "Coccinelle",
    svg: S(
      `<ellipse cx="32" cy="36" rx="22" ry="20" fill="#d43a2f"/><circle cx="32" cy="14" r="9" fill="#1a1a1a"/><line x1="32" y1="16" x2="32" y2="56" stroke="#1a1a1a" stroke-width="3"/><circle cx="22" cy="30" r="4" fill="#1a1a1a"/><circle cx="42" cy="30" r="4" fill="#1a1a1a"/><circle cx="24" cy="44" r="4" fill="#1a1a1a"/><circle cx="40" cy="44" r="4" fill="#1a1a1a"/>`
    ),
  },
  {
    id: "duck",
    name: "Canard",
    svg: S(
      `<ellipse cx="30" cy="42" rx="22" ry="16" fill="#f6c944"/><circle cx="44" cy="24" r="12" fill="#f6c944"/><circle cx="48" cy="21" r="2.5" fill="#1a1a1a"/><path d="M54 24 L64 27 L54 31 Z" fill="#e8842c"/><path d="M14 40 Q6 44 12 50 Q20 48 22 44 Z" fill="#eab526"/>`
    ),
  },
  {
    id: "ghost",
    name: "Fantôme",
    svg: S(
      `<path d="M12 30 a20 20 0 0 1 40 0 v22 l-6-5 -7 6 -7-6 -7 6 -7-6 -6 5 Z" fill="#f4f4f8"/><circle cx="24" cy="28" r="4" fill="#1a1a1a"/><circle cx="40" cy="28" r="4" fill="#1a1a1a"/><ellipse cx="32" cy="38" rx="4" ry="6" fill="#1a1a1a"/>`
    ),
  },
  {
    id: "alien",
    name: "Alien",
    svg: S(
      `<ellipse cx="32" cy="30" rx="18" ry="22" fill="#6fce55"/><ellipse cx="25" cy="28" rx="6" ry="9" fill="#1a1a1a" transform="rotate(20 25 28)"/><ellipse cx="39" cy="28" rx="6" ry="9" fill="#1a1a1a" transform="rotate(-20 39 28)"/><path d="M28 44 Q32 48 36 44" stroke="#1a1a1a" stroke-width="2" fill="none"/>`
    ),
  },
  {
    id: "mushroom",
    name: "Champignon",
    svg: S(
      `<path d="M8 32 a24 22 0 0 1 48 0 Z" fill="#d43a2f"/><rect x="24" y="32" width="16" height="22" rx="6" fill="#f0e2c8"/><circle cx="20" cy="22" r="5" fill="#fff"/><circle cx="38" cy="16" r="6" fill="#fff"/><circle cx="48" cy="26" r="4" fill="#fff"/>`
    ),
  },
  {
    id: "star",
    name: "Étoile",
    svg: S(
      `<path d="M32 4 L39 24 L60 24 L43 37 L49 58 L32 45 L15 58 L21 37 L4 24 L25 24 Z" fill="#f6c944" stroke="#d99b1f" stroke-width="2"/>`
    ),
  },
  {
    id: "heart",
    name: "Cœur",
    svg: S(
      `<path d="M32 56 C8 40 4 24 14 14 C22 7 30 12 32 18 C34 12 42 7 50 14 C60 24 56 40 32 56 Z" fill="#e84a6f"/>`
    ),
  },
  {
    id: "donut",
    name: "Donut",
    svg: S(
      `<circle cx="32" cy="32" r="24" fill="#e8927c"/><circle cx="32" cy="32" r="9" fill="#fff"/><path d="M12 28 a20 20 0 0 1 40 0 q-5 6 -10 2 t-10 2 t-10-2 t-10-2" fill="#8a4fbe"/><circle cx="22" cy="22" r="1.8" fill="#f6c944"/><circle cx="34" cy="18" r="1.8" fill="#6fce55"/><circle cx="44" cy="26" r="1.8" fill="#4aa3e8"/>`
    ),
  },
  {
    id: "bolt",
    name: "Éclair",
    svg: S(
      `<path d="M36 4 L14 36 L28 36 L24 60 L50 26 L34 26 Z" fill="#f6c944" stroke="#d99b1f" stroke-width="2"/>`
    ),
  },
  {
    id: "eye",
    name: "Œil",
    svg: S(
      `<path d="M4 32 Q32 8 60 32 Q32 56 4 32 Z" fill="#fff" stroke="#1a1a1a" stroke-width="2"/><circle cx="32" cy="32" r="11" fill="#4aa3e8"/><circle cx="32" cy="32" r="5" fill="#1a1a1a"/><circle cx="35" cy="29" r="2" fill="#fff"/>`
    ),
  },
  {
    id: "cactus",
    name: "Cactus",
    svg: S(
      `<rect x="26" y="12" width="12" height="36" rx="6" fill="#4c9e4c"/><rect x="10" y="22" width="10" height="16" rx="5" fill="#4c9e4c"/><rect x="14" y="30" width="14" height="8" rx="4" fill="#4c9e4c"/><rect x="44" y="18" width="10" height="14" rx="5" fill="#4c9e4c"/><rect x="38" y="24" width="12" height="8" rx="4" fill="#4c9e4c"/><path d="M20 48 h24 l-3 12 h-18 Z" fill="#c96a3b"/>`
    ),
  },
  {
    id: "butterfly",
    name: "Papillon",
    svg: S(
      `<ellipse cx="20" cy="24" rx="13" ry="15" fill="#8a4fbe"/><ellipse cx="44" cy="24" rx="13" ry="15" fill="#8a4fbe"/><ellipse cx="22" cy="44" rx="10" ry="11" fill="#4aa3e8"/><ellipse cx="42" cy="44" rx="10" ry="11" fill="#4aa3e8"/><rect x="29" y="14" width="6" height="38" rx="3" fill="#1a1a1a"/><circle cx="26" cy="24" r="3.5" fill="#f6c944"/><circle cx="38" cy="24" r="3.5" fill="#f6c944"/>`
    ),
  },
];

export function getSticker(id: string): Sticker {
  return STICKERS.find((s) => s.id === id) ?? STICKERS[0];
}

export function stickerDataUrl(id: string): string {
  return `data:image/svg+xml,${encodeURIComponent(getSticker(id).svg)}`;
}
