# Roadmap — Zoom Hide

Petit backlog vivant, alimenté par la routine quotidienne automatisée.
Règle : une seule amélioration livrée par jour, petite et testée.

## Backlog

- Partage : remplacer le `prompt()`/`alert()` natifs du bouton « Signaler »
  par une petite modale in-app (meilleure UX mobile, cohérente avec le reste
  du design).
- Perf/coût : vérifier périodiquement l'usage réel du bucket Storage et des
  lignes `attempts`/`hides` dans le dashboard Supabase (rester sous les
  quotas Free tier) — pas un item de code, plutôt un rappel de suivi manuel.

## En cours

_(rien pour l'instant)_

## Fait

- **2026-07-18** — Badge « déjà tenté » / « déjà trouvé » sur les cartes du
  feed public, via une nouvelle RPC légère `get_hide_statuses` (batch, un
  seul appel pour toute la page, ne renvoie que les ids où le joueur a une
  tentative — jamais de position).
- **2026-07-17** — Ajout des balises Open Graph / Twitter Card + image de
  partage statique (`public/og-image.png`, générée hors-ligne, zéro compute
  serveur) pour que le lien du jeu affiche un aperçu soigné quand il est
  partagé en bio Instagram, DM, ou tout autre réseau/app de messagerie.
