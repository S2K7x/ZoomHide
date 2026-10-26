"use client";

import { useSyncExternalStore } from "react";
import { getPlayerName } from "@/lib/player";
import Avatar from "@/components/Avatar";

// Pastille « profil » en haut de l'accueil. Le pseudo vit en localStorage :
// lu côté client uniquement, « Guest » au rendu serveur (et tant qu'il n'a
// pas joué).
const noSubscribe = () => () => {};
export default function PlayerChip() {
  const name = useSyncExternalStore(noSubscribe, getPlayerName, () => "");
  const shown = name || "Guest";
  return (
    <span className="zh-card !rounded-full inline-flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 text-sm font-semibold">
      <Avatar name={shown} size={32} />
      <span className="max-w-[9rem] truncate">{shown}</span>
    </span>
  );
}
