# Roadmap — Zoom Hide

Petit backlog vivant, alimenté par la routine quotidienne automatisée.
Règle : une seule amélioration livrée par jour, petite et testée.

## Backlog

- Perf/coût : vérifier périodiquement l'usage réel du bucket Storage et des
  lignes `attempts`/`hides` dans le dashboard Supabase (rester sous les
  quotas Free tier) — pas un item de code, plutôt un rappel de suivi manuel.
- Perf (priorité basse) : l'advisor Supabase signale `reports.hide_id` (FK
  vers `hides`, `on delete cascade`) sans index couvrant
  (`unindexed_foreign_keys`, niveau INFO). Actuellement sans impact réel :
  `delete_hide`/`expire_hides` ne font que `update ... set status = ...`,
  jamais de `delete from hides`, donc le cascade ne se déclenche jamais en
  pratique, et `reports` n'est lu nulle part (pas de dashboard modération).
  À ajouter seulement si un vrai `delete from hides` ou une lecture par
  `hide_id` apparaît un jour.
- UX : remplacer les icônes PWA générées via `next/og`
  (`app/icon-192/route.tsx`, `app/icon-512/route.tsx`, loupe dessinée en CSS)
  par les vraies icônes de marque, une fois `public/assets/logo.png`
  disponible (dossier encore vide à ce jour).
- Note : l'index composite sur `attempts(hide_id, player_id, ...)` évoqué
  précédemment existe déjà (`idx_attempts_daily`, migration `001_init.sql`)
  — retiré du backlog, rien à faire.

## En cours

_(rien pour l'instant)_

## Fait

- **2026-08-10** — Rang personnel sur `/leaderboard` quand le joueur est
  hors du top 50 renvoyé par `get_leaderboard` (`app/leaderboard/page.tsx`).
  Nouvelle RPC `get_my_rank` (`supabase/migrations/011_my_leaderboard_rank.sql`)
  qui recalcule le même classement (mêmes formules de score, même filtre de
  période) sans `limit`, mais ne renvoie que la ligne du joueur demandé —
  jamais les autres joueurs. Appelée uniquement quand le joueur n'apparaît
  pas déjà dans les 50 lignes de `get_leaderboard` (aucune requête
  supplémentaire sinon), et affichée comme une ligne « You » distincte
  (bordure en pointillés) sous le classement visible.
- **2026-08-09** — Indicateur de chargement (squelette `.zh-skeleton`) sur
  `components/RevealShare.tsx`, affiché à la place du canvas vide pendant
  la génération de l'image story (photo + sticker + score dessinés en
  asynchrone), le temps que `ready` passe à `true`.
- **2026-08-08** — Fermeture de la modale « Report this hide »
  (`components/HideGame.tsx`) via la touche Échap, en plus du clic en
  dehors déjà géré.
- **2026-08-07** — Design : rafraîchissement du système visuel partagé
  (`app/globals.css`) — anneau de focus clavier global (`:focus-visible`),
  classes réutilisables `.zh-chip`/`.zh-badge`/`.zh-skeleton` (shimmer)/
  `.zh-card-interactive` remplaçant les chaînes Tailwind dupliquées de
  `/play` et `/leaderboard`, états de survol limités aux pointeurs fins,
  respect de `prefers-reduced-motion`, plus quelques finitions
  (halo hero + fil des étapes sur `/`, `aria-current` dans `NavBar`,
  titre du feed sur une seule ligne en 390px, podium et ligne « you » du
  leaderboard renforcés).
- **2026-08-07** — UX mobile : `app/manifest.ts` (nom, description,
  `display: standalone`, `theme_color`/`background_color` alignés sur le
  thème sombre existant) pour permettre le "Add to Home Screen" sur mobile.
  Icônes 192×192 et 512×512 générées via `next/og` (`app/icon-192/route.tsx`,
  `app/icon-512/route.tsx`, loupe sur fond dégradé ambre, même style que
  l'icône hero de la page d'accueil) au lieu d'attendre les PNG détourés du
  mascot (pas encore déposés dans `public/assets/`) — routes marquées
  `force-static`, donc pré-rendues en fichiers statiques au build, zéro
  compute serveur à l'exécution. À remplacer par les vraies icônes de marque
  une fois `public/assets/logo.png` disponible.
- **2026-08-06** — Bouton « ↺ Reset zoom » sur `components/ZoomPanViewer.tsx`,
  affiché en bas à droite de la photo dès que le joueur a zoomé (`scale >
  1`), pour revenir d'un coup au cadrage initial (`scale`/`x`/`y` remis à
  leur valeur de départ) au lieu de devoir pincer-dézoomer manuellement.
- **2026-08-05** — Squelette de chargement (pulsation `animate-pulse`) sur
  la photo de jeu dans `components/ZoomPanViewer.tsx` (écran `/play/[hideId]`
  et `/play/private/[token]`), au lieu d'un cadre noir vide pendant le
  téléchargement de la photo. Ratio 1:1 par défaut avant que la vraie photo
  ne soit connue, pour que le squelette ait une hauteur stable au lieu de
  s'effondrer à 0.
- **2026-08-04** — UX : remplacement du `confirm()` natif du bouton « Delete
  this hide » de `/create` par une modale in-app cohérente avec le design
  (`zh-card`/`zh-btn`), même pattern que la modale de report déjà en place
  dans `HideGame.tsx`. Dernier dialogue natif du navigateur (`alert`/
  `confirm`/`prompt`) restant dans le code, repéré par recherche complète du
  repo.
- **2026-08-03** — Sécurité : suppression de la policy RLS `"public read
  photos"` sur `storage.objects` (bucket `photos`), qui autorisait le
  listing complet du bucket (n'importe qui pouvait énumérer toutes les
  photos jamais uploadées, y compris celles de cachettes privées ou
  expirées) — signalé par l'advisor de sécurité Supabase
  (`public_bucket_allows_listing`). L'affichage des photos dans l'app
  (`getPublicUrl()`) ne dépend pas de cette policy (le bucket est déjà
  `public = true`, l'accès direct par URL passe par une route qui ne
  vérifie pas les RLS), donc aucune régression possible. Migration
  `supabase/migrations/010_restrict_photo_bucket_listing.sql`.
- **2026-08-02** — Indicateur "cachette active" sur la barre de navigation :
  un petit point vert sur l'icône 📸 Hide quand le joueur a déjà une
  cachette en cours, visible sur toutes les pages (avant, ce n'était visible
  qu'en ouvrant `/create`). Nouvelle RPC dédiée `has_active_hide` (booléen,
  `supabase/migrations/009_has_active_hide.sql`), appelée une seule fois par
  session côté `components/NavBar.tsx` (la nav ne remonte pas entre les
  navigations client-side). S'appuie sur l'index partiel unique déjà
  existant `uniq_active_hide_per_creator` : coût quasi nul, aucune donnée
  sensible renvoyée.
- **2026-08-01** — Gestion des erreurs réseau/API sur `/play` et
  `/leaderboard` : les deux pages ignoraient l'`error` retourné par
  Supabase (`const { data } = await ...`) et affichaient silencieusement
  l'état "vide" ("No active hides yet." / "No one on the board yet.") en
  cas d'échec de la requête (coupure réseau, panne Supabase). Ajout d'un
  état d'erreur dédié avec message explicite et bouton « Try again » sur
  les deux pages, cohérent avec la gestion d'erreur déjà en place dans
  `HideGame.tsx`/`PrivatePlay.tsx`. L'item de backlog précédent
  (surlignage de la ligne du joueur sur `/leaderboard`) s'est avéré déjà
  implémenté depuis le commit MVP initial — retiré du backlog, remplacé
  par de nouvelles idées ci-dessus.
- **2026-07-31** — Respect de `prefers-reduced-motion` pour toutes les
  animations `animate-pulse` (squelettes de `/play` et `/leaderboard`, halo
  du cercle de révélation dans `HideGame.tsx`) via une seule règle CSS
  globale dans `app/globals.css`.
- **2026-07-30** — Audit d'accessibilité des boutons icône-seule et ajout du
  `aria-label` manquant sur les swatches de couleur préréglées de
  `app/create/page.tsx` (`COLOR_PRESETS`, ex. « Use color #3f6f5a »). Les
  boutons visés à l'origine par l'item de backlog (🔄 refresh sur `/play`,
  🔗 Share/🚩 Report sur `HideGame.tsx`) avaient déjà un nom accessible
  (aria-label existant ou texte visible) ; seuls ces swatches n'exposaient
  qu'un attribut `title`, peu fiable pour les lecteurs d'écran tactiles.
- **2026-07-29** — Léger retour haptique (`navigator.vibrate`) sur tentative
  trouvée/ratée dans `components/HideGame.tsx` (double vibration courte sur
  succès, simple vibration brève sur échec). API native, aucune dépendance,
  repli totalement silencieux (try/catch + vérification de présence de
  l'API) sur les navigateurs qui ne la supportent pas, notamment iOS Safari.
- **2026-07-28** — Filtre « 🙈 Hide tried/found » sur le feed `/play`, à
  côté des tris existants (Newest/Hardest/Expiring). Masque côté client les
  cachettes déjà marquées `attempted`/`found` (déjà chargées via
  `get_hide_statuses`, aucune nouvelle requête), préférence retenue en
  `localStorage`. Message dédié + bouton pour désactiver le filtre quand
  toutes les cachettes de la page courante sont filtrées.
- **2026-07-27** — Feedback visuel « ✅ Copied! » sur les 3 boutons de
  copie de lien de `app/create/page.tsx` (lien direct de cachette privée,
  lien du jeu après publication publique, lien privé de la cachette
  active). Même pattern que le bouton de partage de `HideGame.tsx` ajouté
  la veille : confirmation affichée 1.5s à la place du libellé du bouton.
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
