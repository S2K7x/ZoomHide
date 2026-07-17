# Roadmap — Zoom Hide

Petit backlog vivant, alimenté par la routine quotidienne automatisée.
Règle : une seule amélioration livrée par jour, petite et testée.

## Backlog

- Feed : afficher un badge « déjà tenté » / « déjà trouvé » sur les cachettes
  du feed pour le joueur courant (évite de perdre du temps sur une cachette
  déjà jouée). Nécessite une nouvelle RPC légère (batch status), à concevoir
  pour ne pas alourdir le feed (actuellement une seule requête sur la vue
  `active_hides`).
- Partage : remplacer le `prompt()`/`alert()` natifs du bouton « Signaler »
  par une petite modale in-app (meilleure UX mobile, cohérente avec le reste
  du design).
- Perf/coût : vérifier périodiquement l'usage réel du bucket Storage et des
  lignes `attempts`/`hides` dans le dashboard Supabase (rester sous les
  quotas Free tier) — pas un item de code, plutôt un rappel de suivi manuel.

## En cours

_(rien pour l'instant)_

## Fait

- **2026-07-17** — Ajout des balises Open Graph / Twitter Card + image de
  partage statique (`public/og-image.png`, générée hors-ligne, zéro compute
  serveur) pour que le lien du jeu affiche un aperçu soigné quand il est
  partagé en bio Instagram, DM, ou tout autre réseau/app de messagerie.
