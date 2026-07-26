# Roadmap — Zoom Hide

Petit backlog vivant, alimenté par la routine quotidienne automatisée.
Règle : une seule amélioration livrée par jour, petite et testée.

## Backlog

- Perf/coût : vérifier périodiquement l'usage réel du bucket Storage et des
  lignes `attempts`/`hides` dans le dashboard Supabase (rester sous les
  quotas Free tier) — pas un item de code, plutôt un rappel de suivi manuel.
- UX : feedback visuel « Copié ! » sur les boutons de copie de lien déjà
  existants dans `/create` (code privé, lien public, lien direct) — ils
  copient silencieusement dans le presse-papier sans confirmation à
  l'écran, contrairement au nouveau bouton de partage ajouté aujourd'hui.
- Gameplay : filtre « Masquer déjà tenté/trouvé » sur le feed `/play`, en
  plus des badges existants, pour que les joueurs réguliers voient d'abord
  les cachettes fraîches (calcul 100% front à partir de `statuses`, déjà
  chargé, aucune nouvelle requête).
- UX mobile : léger retour haptique (`navigator.vibrate`) sur tentative
  trouvée/ratée dans `HideGame.tsx`, avec repli silencieux sur les
  navigateurs qui ne le supportent pas — aucune dépendance, API native.

## En cours

_(rien pour l'instant)_

## Fait

- **2026-07-26** — Bouton « 🔗 Share this hide » sur l'écran de jeu
  (`components/HideGame.tsx`), à côté de « 🚩 Report this hide ». Utilise
  `navigator.share` si disponible (mobile), sinon copie le lien de la
  cachette courante dans le presse-papier avec confirmation « ✅ Link
  copied! » pendant 1.5s.
- **2026-07-25** — Pagination du feed `/play` : chargement par pages de 20
  cachettes (au lieu de 60 d'un coup) avec bouton « Load more » en bas de la
  grille, au lieu d'une limite fixe de 60 résultats.
- **2026-07-24** — Squelette de chargement (skeleton) sur `/leaderboard`
  (`app/leaderboard/page.tsx`), reprenant la forme du podium (3 blocs) et de
  la liste (5 lignes) à la place du texte « Loading… », même idée que le
  squelette du feed `/play` du 2026-07-23.
- **2026-07-23** — Squelette de chargement (skeleton cards) sur le feed
  `/play` (`app/play/page.tsx`), affiché à la place du texte « Loading… »
  pendant le premier chargement, pour un rendu moins abrupt sur mobile.
- **2026-07-22** — Bouton de rafraîchissement manuel sur le feed `/play`
  (`app/play/page.tsx`), à côté du titre, avec icône 🔄 animée pendant le
  chargement, indépendant du spinner de chargement initial (état
  `refreshing` séparé). Réutilise le fetch existant (`active_hides` +
  `get_hide_statuses`), aucune nouvelle requête ni RPC.
- **2026-07-21** — Countdown « reset dans Xh Ym » affiché à la place du texte
  générique « come back tomorrow » quand `attempts_left === 0`
  (`components/HideGame.tsx`), calculé côté client sur minuit UTC (aligné sur
  `current_date` côté serveur), aucune nouvelle RPC.
- **2026-07-20** — Repères visuels des tentatives ratées précédentes sur la
  photo pendant la partie (`components/HideGame.tsx`), pour aider le joueur
  à mémoriser les zones déjà écartées entre ses 3 tentatives/jour.
- **2026-07-19** — Remplacement du `prompt()`/`alert()` natifs du bouton
  « Signaler » par une petite modale in-app (`HideGame.tsx`), cohérente avec
  le reste du design (`zh-card`/`zh-btn`).
- **2026-07-18** — Badge « déjà tenté » / « déjà trouvé » sur les cartes du
  feed public, via une nouvelle RPC légère `get_hide_statuses` (batch, un
  seul appel pour toute la page, ne renvoie que les ids où le joueur a une
  tentative — jamais de position).
- **2026-07-17** — Ajout des balises Open Graph / Twitter Card + image de
  partage statique (`public/og-image.png`, générée hors-ligne, zéro compute
  serveur) pour que le lien du jeu affiche un aperçu soigné quand il est
  partagé en bio Instagram, DM, ou tout autre réseau/app de messagerie.
