import { ImageResponse } from "next/og";
import { iconArt } from "@/lib/iconArt";

export const dynamic = "force-static";
export const contentType = "image/png";

const SIZE = 512;

// Fond plein (pas de coins arrondis) : le système (iOS, Android) applique son
// propre masque à l'icône installée.
export function GET() {
  return new ImageResponse(iconArt(SIZE), { width: SIZE, height: SIZE });
}
