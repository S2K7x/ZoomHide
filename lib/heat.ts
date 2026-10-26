// Retour « chaud / froid » d'une tentative ratée et résultat partageable sans
// spoiler (façon Wordle). Tout est dérivé de la `distance` déjà renvoyée par
// try_attempt : aucune info sur la position n'est ajoutée côté client.

export type Tap = { x: number; y: number; distance: number };

// 0 = froid … 3 = brûlant. Seuils en % de largeur d'image (mêmes qu'avant).
export function heatLevel(d: number): 0 | 1 | 2 | 3 {
  return d < 8 ? 3 : d < 18 ? 2 : d < 35 ? 1 : 0;
}

export const HEAT = [
  { label: "🧊 Cold, look elsewhere.", short: "Cold", square: "🟦", ring: "border-sky-400 bg-sky-400/15", bar: "bg-sky" },
  { label: "🌤️ Lukewarm.", short: "Lukewarm", square: "🟨", ring: "border-yellow-300 bg-yellow-300/15", bar: "bg-yellow" },
  { label: "♨️ Hot, getting warmer.", short: "Hot", square: "🟧", ring: "border-orange-400 bg-orange-400/20", bar: "bg-orange" },
  { label: "🔥 Burning! So close…", short: "Burning", square: "🟥", ring: "border-rose-400 bg-rose-400/25", bar: "bg-pink" },
] as const;

// Comparaison avec le tap précédent : la tendance aide plus que le palier seul
// (deux taps « Lukewarm » peuvent être de chaque côté du sticker).
export function heatTrend(d: number, prev: number | undefined): string | null {
  if (prev === undefined) return null;
  if (d < prev - 1) return "⬆️ Warmer than your last tap";
  if (d > prev + 1) return "⬇️ Colder than your last tap";
  return "↔️ About as far as your last tap";
}

// Historique local des taps par cachette : garde les anneaux colorés et le
// résultat partageable après un rechargement. Purement cosmétique — le serveur
// reste seul juge des essais restants.
type History = { taps: Tap[]; found?: boolean; timeMs?: number };

const key = (hideId: string) => `zh_taps_${hideId}`;

export function loadHistory(hideId: string): History {
  if (typeof window === "undefined") return { taps: [] };
  try {
    const h = JSON.parse(localStorage.getItem(key(hideId)) ?? "null");
    return h && Array.isArray(h.taps) ? h : { taps: [] };
  } catch {
    return { taps: [] };
  }
}

export function saveHistory(hideId: string, h: History) {
  try {
    localStorage.setItem(key(hideId), JSON.stringify(h));
  } catch {
    // stockage plein ou bloqué (navigation privée) : on perd juste l'historique
  }
}

const MAX_SQUARES = 12;

// Ex. « Zoom Hide 🔎 Find the Star\n🟦🟨🟧🟩 Found in 42s!\nhttps://… »
export function shareText({
  shapeName,
  taps,
  found,
  timeMs,
  url,
}: {
  shapeName: string;
  taps: Tap[];
  found: boolean;
  timeMs?: number;
  url: string;
}): string {
  let squares: string[] = taps.map((t) => HEAT[heatLevel(t.distance)].square);
  if (squares.length > MAX_SQUARES) squares = ["…", ...squares.slice(-MAX_SQUARES)];
  if (found) squares.push("🟩");
  const outcome = found
    ? timeMs
      ? `Found in ${Math.round(timeMs / 1000)}s!`
      : "Found it!"
    : "Still hunting… can you find it?";
  return `Zoom Hide 🔎 Find the ${shapeName}\n${squares.join("")} ${outcome}\n${url}`;
}
