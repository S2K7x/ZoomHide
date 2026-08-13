# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

## 2026-08-13

**Sécurité : `upsert_player()` n'est plus appelable publiquement — n'importe
qui pouvait renommer les joueurs du classement.**

- `supabase/migrations/013_restrict_upsert_player.sql` : `revoke execute ...
  from public, anon, authenticated` sur `upsert_player(text, text)`.

Le problème : `001_init.sql` ligne 353 accorde explicitement `grant execute on
function upsert_player(text, text) to anon, authenticated`, juste après le
`revoke execute on all functions`. Ce grant date du prototype et n'a jamais
été nécessaire : la fonction n'est appelée que depuis `create_hide` et
`try_attempt`, deux fonctions `security definer` appartenant à `postgres` — un
appel imbriqué s'exécute sous le propriétaire, pas sous `anon`. Aucun
`supabase.rpc("upsert_player", ...)` n'existe dans le repo (recherche
complète : les 11 RPC appelées côté client sont `create_hide`, `delete_hide`,
`get_hide_by_code`, `get_hide_detail`, `get_hide_statuses`, `get_leaderboard`,
`get_my_active_hide`, `get_my_rank`, `has_active_hide`, `report_hide`,
`try_attempt`).

Pourquoi ça compte : le corps de la fonction est un

```sql
insert into players (id, name) values (p_player_id, left(..., 24))
on conflict (id) do update set name = excluded.name;
```

sans la moindre vérification de propriété — le `p_player_id` n'est qu'un
identifiant généré côté client et stocké en `localStorage`, il n'y a pas
d'authentification dans le jeu. Or `get_leaderboard` renvoie publiquement le
`player_id` des 50 meilleurs joueurs (le client s'en sert pour surligner la
ligne « you » sur `/leaderboard`). La chaîne d'attaque tenait donc en deux
requêtes anonymes : `POST /rest/v1/rpc/get_leaderboard` pour récupérer les ids,
puis `POST /rest/v1/rpc/upsert_player` pour réécrire le pseudo de n'importe
lequel d'entre eux. Le pseudo est affiché sur `/leaderboard`, sur chaque carte
du feed public (`active_hides.creator_name`), sur l'écran de jeu et sur l'image
de partage story : vandalisme et usurpation de pseudo à la portée de tout
visiteur, sans aucune trace côté victime. Accessoirement, la branche `insert`
permettait de créer un nombre illimité de lignes `players` (tout id de 8 à 64
caractères), donc de gonfler gratuitement la base du Free tier.

Vérifications faites en base, avant/après :

- Avant, `set local role anon; select upsert_player('zh-probe-000001',
  'PROBE_ROLLED_BACK')` réussissait et écrivait bien la ligne (transaction
  annulée par `rollback`, aucune donnée réelle touchée).
- Après, le même appel renvoie `ERROR 42501: permission denied for function
  upsert_player`, et `has_function_privilege('anon'|'authenticated', ...)`
  renvoie `false`.
- Le chemin interne est intact : toujours sous `role anon`, un
  `try_attempt(<uuid inexistant>, 'zh-probe-000002', 'INTERNAL', ...)` a bien
  créé/mis à jour la ligne `players` avec le pseudo `INTERNAL` avant de
  retourner son erreur métier `not_active` (transaction annulée ; contrôle
  final : zéro ligne `zh-probe-%` restante). Aucune régression sur
  `create_hide`/`try_attempt`, qui enregistrent le pseudo du joueur comme
  avant.
- L'advisor sécurité Supabase ne liste plus `upsert_player` dans
  `anon_security_definer_function_executable` /
  `authenticated_security_definer_function_executable` ; ne restent que les 11
  RPC publiques par conception et les avertissements déjà connus et acceptés
  (RLS "enabled no policy" sur les tables, vue `active_hides` en `security
  definer`).

Item choisi car la routine donne la priorité absolue aux failles de sécurité,
et parce que le premier item du backlog était précisément le contrôle de
process « quelles fonctions `public` sont exécutables par `anon` ? » — c'est ce
contrôle qui a débusqué celle-ci. Contrairement à la faille du 2026-08-12
(fonctions oubliées par le `revoke`), celle-ci venait d'un grant délibéré mais
devenu inutile : le contrôle doit donc comparer la liste exécutable à la liste
des RPC réellement appelées, pas seulement chercher les oublis. Changement 100%
SQL, zéro ligne de code applicatif, aucune règle de jeu modifiée, aucune
nouvelle dépendance, impact quotas nul (au contraire : ferme un vecteur
d'écriture anonyme). `npm run build` passe (12 routes générées).

Piste laissée au backlog : la racine du problème est que `get_leaderboard`
expose les `player_id`, ce qui rend usurpable toute RPC acceptant un
`p_player_id` sans preuve de possession. Audit à faire RPC par RPC, et à terme
remplacer `player_id` par un `is_me` calculé côté serveur dans le classement.

## 2026-08-12

**Sécurité : les fonctions de maintenance `expire_hides()` et
`cleanup_old_photos()` ne sont plus appelables publiquement.**

- `supabase/migrations/012_restrict_maintenance_functions.sql` : `revoke
  execute ... from public, anon, authenticated` sur les deux fonctions.

Le problème : dans `001_init.sql`, le garde-fou `revoke execute on all
functions in schema public from public, anon, authenticated` (ligne 352) est
exécuté **avant** la création de `expire_hides()` (ligne 379) et
`cleanup_old_photos()` (ligne 401), en fin de fichier avec les jobs cron. Les
deux fonctions ont donc gardé le `grant execute to public` par défaut de
Postgres, complété par les default privileges Supabase (`anon`,
`authenticated`) — vérifié dans la base : `proacl` valait `=X/postgres |
postgres=X/postgres | anon=X/postgres | authenticated=X/postgres |
service_role=X/postgres`. Concrètement, n'importe qui muni de la clé publique
(présente dans le bundle front, par conception) pouvait appeler
`POST /rest/v1/rpc/expire_hides` et `POST /rest/v1/rpc/cleanup_old_photos`.

Pourquoi ça compte : `cleanup_old_photos()` exécute un `delete from
storage.objects` joint aux `hides` par `like '%' || o.name` (scan du bucket ×
cachettes expirées à chaque appel), `expire_hides()` un `update` sur toute la
table `hides` avec deux sous-requêtes corrélées sur `attempts` par ligne.
Aucune des deux ne permet de tricher (`expire_hides` ne touche que les
cachettes dont `expires_at <= now()`, donc pas d'expiration anticipée
possible ; `cleanup_old_photos` ne supprime que ce que le cron aurait
supprimé), mais ce sont deux écritures déclenchables par un anonyme et un
levier gratuit d'épuisement du compute Postgres du Free tier — appels
illimités, aucune limitation de débit côté RPC. Aucun appel côté client ne les
référence (recherche `supabase.rpc(...)` sur tout le repo : les 11 RPC
appelées sont `create_hide`, `delete_hide`, `get_hide_by_code`,
`get_hide_detail`, `get_hide_statuses`, `get_leaderboard`,
`get_my_active_hide`, `get_my_rank`, `has_active_hide`, `report_hide`,
`try_attempt`) : elles ne servent qu'à pg_cron.

Vérifications faites : les jobs `expire-hides` et `cleanup-photos`
(`cron.job`) tournent sous l'utilisateur `postgres`, propriétaire des
fonctions — leur exécution planifiée est donc intacte. Après migration,
`has_function_privilege('anon'|'authenticated', ...)` renvoie `false` sur les
deux, et un test `set local role anon` confirme `insufficient_privilege` sur
`expire_hides()`/`cleanup_old_photos()` tout en laissant passer
`get_leaderboard()` et `has_active_hide()` (aucune régression sur les RPC de
jeu). L'advisor sécurité Supabase ne liste plus ces deux fonctions dans
`anon_security_definer_function_executable` /
`authenticated_security_definer_function_executable` ; ne restent que les RPC
publiques par conception et les avertissements déjà connus et acceptés (RLS
"enabled no policy" sur les tables, vue `active_hides` en `security definer`).

Item choisi car la routine donne la priorité absolue aux failles de sécurité,
devant le backlog. Changement 100% SQL, zéro ligne de code applicatif, aucune
règle de jeu modifiée, aucune nouvelle dépendance, impact quotas nul (au
contraire : ferme un vecteur de consommation compute). `npm run build` passe
(12 routes générées).

## 2026-08-10

**Gameplay : rang personnel affiché sur `/leaderboard` hors du top 50.**

- Nouvelle RPC `get_my_rank(p_player_id, p_board, p_period)`
  (`supabase/migrations/011_my_leaderboard_rank.sql`) : recalcule le même
  classement que `get_leaderboard` (mêmes formules — 10 pts/raté provoqué +
  500/Cachette Parfaite pour les hiders, 100 - 25/raté préalable - 1pt/s
  (cap 50, min 10) par trouvaille pour les seekers — et même filtre de
  période), via `rank() over (...)`, sans le `limit 50` de `get_leaderboard`.
  Ne renvoie que la ligne du joueur demandé (rang + score), jamais le
  classement des autres joueurs.
- `app/leaderboard/page.tsx` : après le chargement du top 50, si le joueur
  courant n'y figure pas, un second appel va chercher uniquement son rang
  (aucune requête si le joueur est déjà visible dans le top 50), affiché en
  ligne « You » distincte (bordure en pointillés ambre) sous le classement.

Pourquoi : `get_leaderboard` (`001_init.sql`) tronque à 50 lignes depuis le
début — un joueur classé au-delà n'avait aucun moyen de connaître sa
position ni son score, alors que le reste du produit (badge "cachette
active", indicateurs "déjà tenté/trouvé"...) donne systématiquement un
retour personnel au joueur. Item choisi car aucun bug/faille de sécurité
identifié aujourd'hui (audit `get_advisors` revérifié en amont : mêmes
avertissements déjà connus et acceptés que les jours précédents, `get_my_rank`
n'en ajoute aucun de nouveau), rien en `## En cours`, et le seul item de
code restant du backlog (remplacement des icônes PWA) reste bloqué faute de
`public/assets/logo.png`.

Contraintes respectées : coût de la nouvelle RPC du même ordre de grandeur
qu'un appel à `get_leaderboard` existant (agrégation complète sur
`hides`/`attempts`, sans le `limit`), mais appelée au plus une fois par
affichage de `/leaderboard` et seulement quand nécessaire — pas d'impact
notable sur les quotas Supabase Free tier. Calcul du score et du rang
exclusivement côté serveur (RPC `security definer`, comme le reste du
projet) ; aucune donnée sur les autres joueurs n'est exposée. Aucune règle
de jeu existante modifiée. Zéro nouvelle dépendance. `npm run build` passe ;
`npm run lint` inchangé (mêmes 10 erreurs `react-hooks/set-state-in-effect`/
`react-hooks/purity` déjà présentes sur `main` avant ce changement, propres
à une règle eslint plus stricte sur un pattern utilisé dans tout le repo —
aucune nouvelle erreur introduite par ce fichier).

## 2026-08-09

**UX : indicateur de chargement sur la génération de l'image story (`RevealShare.tsx`).**

- `components/RevealShare.tsx` : le canvas (dessin asynchrone de la photo +
  sticker + score, dans un `useEffect`) était auparavant affiché vide le
  temps que le dessin se termine (`await Promise.all([...])` pour charger la
  photo et le sticker, plusieurs opérations `ctx.drawImage`/dégradés
  ensuite), avec le bouton « Share to story » qui n'apparaissait qu'une fois
  prêt (`ready`) — aucun repère visuel entre les deux, ce qui pouvait laisser
  croire à un blocage sur mobile lent. Le canvas est maintenant enveloppé
  dans un conteneur à ratio 9:16 stable (`aspectRatio: "9 / 16"`, évite tout
  effondrement de hauteur avant que le canvas ne prenne ses dimensions
  réelles) avec une superposition `.zh-skeleton` (shimmer déjà existant,
  utilisé par `/play`, `/leaderboard`, `ZoomPanViewer`) tant que `!ready`,
  masquée dès que le dessin est terminé.

Pourquoi : dernier item de code du backlog. Changement 100% front (CSS/JSX
uniquement, réutilise la classe `.zh-skeleton` déjà établie le 2026-08-07 et
donc déjà couverte par la règle globale `prefers-reduced-motion`), aucune
nouvelle requête ni RPC, zéro impact sur les quotas Supabase/Vercel. Audit
sécurité Supabase (`get_advisors`) revérifié en amont : uniquement les
avertissements déjà connus et acceptés (RLS "enabled no policy" sur
`players`/`hides`/`attempts`/`reports`/`code_attempts`, RPC `security
definer` exposées à `anon`/`authenticated` par design puisque le jeu n'a pas
d'authentification, vue `active_hides` `security definer` par conception) —
aucun nouvel item de sécurité, rien à traiter en priorité aujourd'hui.
Aucune règle de jeu touchée (le calcul de succès et la position du sticker
restent exclusivement côté serveur ; l'image générée ici ne fait que
redessiner ce que le joueur voit déjà après une tentative réussie).
`npm run build` passe.

Backlog : ne restent que le remplacement des icônes PWA générées par les
vraies icônes de marque (bloqué faute de `public/assets/logo.png`), l'index
FK basse priorité (conditionnel, sans impact réel actuellement), et le
rappel de suivi manuel des quotas Supabase.

## 2026-08-08

**Accessibilité : fermeture de la modale « Report this hide » via la touche Échap.**

- `components/HideGame.tsx` : nouvel effet qui écoute `keydown` sur `window`
  tant que la modale de signalement (`showReport`) est ouverte et qu'aucun
  envoi n'est en cours (`reportSubmitting`), et ferme la modale (`setShowReport(false)`)
  sur la touche `Escape` — même garde-fou que le clic en dehors de la carte,
  déjà géré par le `onClick` de l'overlay.

Pourquoi : item d'accessibilité du backlog. La modale de signalement se
fermait déjà au clic en dehors, mais un joueur au clavier (ou un lecteur
d'écran) n'avait aucun moyen de la fermer sans la souris. Changement 100%
front (un seul `useEffect`, aucune nouvelle requête ni RPC), zéro impact sur
les quotas Supabase/Vercel. Aucune règle de jeu ni sécurité touchée. Audit
sécurité Supabase (`get_advisors`) revérifié en amont : uniquement les
avertissements déjà connus et acceptés (RLS "enabled no policy" sur
`players`/`hides`/`attempts`/`reports`/`code_attempts`, tous verrouillés et
accessibles uniquement via RPC `security definer` ; la vue `active_hides`
reste `security definer` par conception pour exposer un sous-ensemble de
colonnes sans jamais renvoyer `pos_x`/`pos_y`) — aucun nouvel item de
sécurité, rien à traiter en priorité aujourd'hui. `npm run build` passe.

Note de merge : cette branche a été ouverte depuis un `main` antérieur aux
PR #23/#24 du 2026-08-07, et son environnement d'exécution ne voyait donc
pas encore le manifest PWA livré entre-temps. La rédaction initiale de cette
entrée le décrivait encore comme « bloqué faute d'outil de génération
d'image » — corrigé ici à la résolution des conflits : le manifest existe
bien (`app/manifest.ts` + icônes `next/og`), seul le remplacement par les
vraies icônes de marque reste en backlog.

Backlog : il reste l'indicateur de chargement sur `RevealShare.tsx`, le
remplacement des icônes PWA générées par les vraies icônes de marque,
l'index FK basse priorité (conditionnel), et le rappel de suivi manuel des
quotas.
## 2026-08-07

**Design : rafraîchissement du système visuel partagé (`app/globals.css`).**

- Accessibilité : anneau de focus clavier global (`:focus-visible`, ambre
  `--ring`) — aucun état de focus visible n'existait jusqu'ici sur les
  boutons, liens et chips, la navigation au clavier était invisible.
- Nouvelles classes réutilisables dans `app/globals.css`, qui remplacent
  des chaînes Tailwind dupliquées d'un écran à l'autre :
  - `.zh-chip` / `.zh-chip-on` / `.zh-chip-on-soft` pour les filtres du feed
    (`/play` : tri + « Hide tried/found ») et la période du leaderboard —
    4 copies inline de la même combinaison `rounded-full px-3.5 py-1.5
    border …` supprimées, avec `aria-pressed` ajouté sur chaque bascule.
  - `.zh-badge` pour les pastilles en surimpression des vignettes du feed
    (temps restant, 🔥 HARD, ✅ Found, 👀 Tried), désormais toutes de même
    taille, même rayon et même bordure.
  - `.zh-skeleton` : dégradé animé (shimmer) à la place des blocs
    `bg-white/10 animate-pulse`, utilisé par les squelettes du feed, du
    leaderboard et de la photo de jeu (`ZoomPanViewer`).
  - `.zh-card-interactive` : soulèvement au survol des cartes cliquables
    (vignette de hide, bouton retour du leaderboard).
- États de survol sur `.zh-btn*` et `.zh-chip`, cantonnés à
  `@media (hover: hover) and (pointer: fine)` pour ne pas laisser d'état
  « collé » après un tap sur mobile. Toutes les nouvelles animations et
  transitions sont neutralisées sous `prefers-reduced-motion: reduce`.
- Page d'accueil : halo ambre respirant derrière l'icône hero
  (`.zh-glow`), badge « 3 tries a day · new hides every day » sous le
  sous-titre, et « How it works » passé en `<ol>` sémantique avec un fil
  vertical dégradé reliant les 3 étapes.
- `NavBar` : `aria-current="page"` sur l'onglet actif (absent jusqu'ici),
  pastille active légèrement agrandie avec transition.
- `/play` : titre « Active hides » ne passe plus sur deux lignes en 390px
  (le lien privé passe de « 🔒 Have a code? » à « 🔒 Code » + `aria-label`
  explicite). `/leaderboard` : marche du 1er mise en avant par un halo
  ambre, ligne du joueur courant renforcée, bouton retour agrandi à 40px
  (cible tactile) avec `aria-label`.

Pourquoi : le système visuel (`zh-card`, `zh-btn*`) couvrait les surfaces et
les boutons mais s'arrêtait là — chips, pastilles et squelettes étaient
réécrits à la main sur chaque écran, avec des variantes qui divergeaient, et
rien ne rendait le focus clavier visible. 100% CSS/JSX, aucune requête ni
RPC ajoutée, aucune règle de jeu ni sécurité touchée.

**UX mobile : PWA installable ("Add to Home Screen") via `app/manifest.ts`.**

- Nouveau `app/manifest.ts` (convention Next.js `MetadataRoute.Manifest`,
  servi automatiquement sur `/manifest.webmanifest` avec le lien `<head>`
  correspondant ajouté par Next) : nom "Zoom Hide", description reprise du
  `<meta description>` existant, `start_url: "/"`, `display: "standalone"`,
  `background_color`/`theme_color` alignés sur `--bg-deep` (`#0a1024`) déjà
  utilisé dans `app/globals.css`.
- Icônes 192×192 et 512×512 (`app/icon-192/route.tsx`,
  `app/icon-512/route.tsx`) générées avec `next/og` (`ImageResponse`, déjà
  fourni par Next.js — aucune nouvelle dépendance) : une loupe dessinée en
  CSS pur (cercle + poignée) sur le même dégradé ambre que l'icône hero de
  `/`. Pas d'emoji (`next/og`/Satori ne les rend pas nativement sans police
  externe) et pas d'assets de marque disponibles ailleurs — `logo.png` du
  dossier `design/asset-prompts/` n'a pas encore été généré/déposé dans
  `public/assets/` (toujours vide à ce jour). Ces icônes générées sont un
  point de départ à remplacer une fois le vrai logo disponible.
- Les deux routes sont marquées `export const dynamic = "force-static"` :
  confirmé au build (`○ /icon-192`, `○ /icon-512`, `○ /manifest.webmanifest`
  listées comme "Static" par `next build`), donc pré-rendues en fichiers
  statiques servis par le CDN Vercel, aucun compute serveur par visite.

Pourquoi : dernier item du backlog gagnant à être fait avant que les vrais
mascot/logo PNG soient prêts — permet dès maintenant l'installation en app
quasi-native sur mobile (icône sur l'écran d'accueil, pas de barre
d'adresse), cohérent avec les balises Open Graph déjà en place
(2026-07-17). Purement front/statique, zéro nouvelle dépendance, zéro
risque sur les quotas Vercel/Supabase (pas de requête réseau ni de RPC),
aucune règle de jeu ni sécurité touchée.

Backlog : items retirés (manifest PWA ici, bouton « Reset zoom » livré la
veille), 2 idées restantes (fermeture Échap de la modale de signalement,
indicateur de chargement sur `RevealShare`), plus les 2 rappels de suivi
non-code (quotas Supabase, index FK `reports.hide_id`).

## 2026-08-06

**UX : bouton « Reset zoom » sur `ZoomPanViewer`.**

- `components/ZoomPanViewer.tsx` : nouveau bouton « ↺ Reset zoom » (style
  `zh-btn-ghost`), affiché en superposition en bas à droite de la photo
  uniquement quand le joueur a zoomé (`scale > 1`, nouvel état `zoomed`
  dérivé dans `apply()`). Un clic remet `t.current` à `{x: 0, y: 0, scale:
  1}` et rappelle `apply()` pour revenir instantanément au cadrage initial,
  sans devoir pincer-dézoomer manuellement. `onPointerDown` du bouton fait
  `stopPropagation()` pour ne pas déclencher la détection de tap du
  conteneur parent (qui placerait sinon un marqueur de tentative sur la
  photo au clic du bouton).

Pourquoi : après un zoom poussé pour examiner une zone précise, revenir à la
vue d'ensemble pour retenter ailleurs demandait plusieurs gestes de pan/pinch
manuels, en particulier pénible sur mobile. Item du backlog du 2026-08-05.
Changement 100% front (JSX/CSS + logique locale au composant), aucune
nouvelle requête ni RPC, zéro impact sur les quotas Supabase/Vercel. Aucune
règle de jeu ni sécurité touchée.

L'autre item priorisé pour aujourd'hui, le manifest PWA ("Add to Home
Screen"), était bloqué par l'absence d'outil de génération d'image
(ImageMagick, sharp, Pillow) dans cet environnement headless pour produire
les icônes PNG 192x192 / 512x512 ; il a été débloqué le lendemain via
`next/og` (voir l'entrée 2026-08-07).

## 2026-08-05

**UX : squelette de chargement sur la photo de jeu (`ZoomPanViewer`).**

- `components/ZoomPanViewer.tsx` : affichage d'un overlay `animate-pulse`
  (icône 🔎 estompée sur fond `bg-white/5`) pendant le téléchargement de la
  photo de jeu, à la place du cadre noir vide précédent (`bg-neutral-900`
  seul). Le conteneur utilise un ratio 1:1 par défaut tant que les
  dimensions réelles de la photo ne sont pas connues (`aspect ?? 1` au lieu
  de `aspect ?? undefined`), pour que le squelette ait une hauteur stable
  au lieu de s'effondrer à 0 avant le premier rendu de l'`<img>`. L'image
  elle-même s'affiche désormais avec un fondu (`transition-opacity`) une
  fois chargée plutôt qu'un pop-in brut.

Pourquoi : c'était le seul écran restant sans repère de chargement, alors
que ce pattern existe déjà pour le feed `/play` (2026-07-23) et
`/leaderboard` (2026-07-24) — la photo de jeu elle-même (`/play/[hideId]`,
`/play/private/[token]`) en était restée dépourvue, avec un flash de cadre
noir peu engageant sur connexion lente. Changement 100% front (CSS/JSX
uniquement, réutilise le pattern `animate-pulse` déjà couvert par la règle
globale `prefers-reduced-motion` du 2026-07-31), aucune nouvelle requête ni
RPC, zéro impact sur les quotas Supabase/Vercel. Aucune règle de jeu ni
sécurité touchée (le calcul de succès et la position du sticker restent
exclusivement côté serveur).

Backlog : complété avec 3 nouvelles idées (bouton « Reset zoom » sur
`ZoomPanViewer`, fermeture de la modale de signalement via Échap,
indicateur de chargement sur la génération de l'image story) pour les
prochaines exécutions, en plus des items déjà notés (manifest PWA, index
FK basse priorité, rappel de suivi des quotas).

## 2026-08-04

**UX : dernier dialogue navigateur natif (`confirm()`) remplacé par une modale in-app.**

- `app/create/page.tsx` : le bouton « 🗑️ Delete this hide » utilisait
  `window.confirm("Delete your active hide?")`. Remplacé par une modale
  in-app (`showDeleteConfirm`/`deleting`) au style `zh-card`/`zh-btn`, avec
  boutons Cancel/Delete et état de chargement pendant l'appel RPC
  `delete_hide`.

Pourquoi : l'audit sécurité Supabase (`get_advisors`) n'a rien remonté de
nouveau — seulement les avertissements déjà connus et acceptés (RLS
"enabled no policy" sur `players`/`hides`/`attempts`/`reports`, qui ne sont
accessibles que via des RPC `security definer` par design ; ces RPC visibles
par `anon`, également volontaire vu qu'il n'y a pas d'authentification dans
le jeu). Le seul nouvel élément — un FK non indexé sur `reports.hide_id`
(niveau INFO) — s'est avéré sans impact réel : `delete_hide`/`expire_hides`
ne font jamais de vrai `delete from hides` (seulement des `update status`),
donc le `on delete cascade` ne se déclenche jamais en pratique, et
`reports` n'est lu nulle part dans l'app. Ajouté au backlog en priorité
basse plutôt que traité aujourd'hui.

En cherchant l'amélioration du jour dans le code plutôt que dans un backlog
qui ne contenait que des rappels de suivi manuel, une recherche complète du
repo (`alert(`/`confirm(`/`prompt(`) a montré qu'il restait exactement un
dialogue natif du navigateur : le `confirm()` de suppression de cachette
sur `/create`. Le `prompt()`/`alert()` du bouton de report avait déjà été
remplacé le 2026-07-19 par une modale identique dans `HideGame.tsx` ; ce
changement termine ce nettoyage en reprenant le même pattern déjà établi.
Changement 100% front (un seul fichier, aucune nouvelle requête ni RPC),
aucun impact sur les quotas, aucune règle de jeu ni sécurité touchée
(même RPC `delete_hide` appelée, avec les mêmes paramètres). `npm run
build` passe.

## 2026-08-03

**Sécurité : bucket Storage `photos` ne permet plus le listing public.**

- `supabase/migrations/010_restrict_photo_bucket_listing.sql` : suppression
  de la policy RLS `"public read photos"` (`for select using (bucket_id =
  'photos')`) sur `storage.objects`, introduite dans la migration initiale
  `001_init.sql`.

Pourquoi : en auditant la sécurité du projet via l'advisor Supabase (étape
prioritaire de la routine, avant même de regarder le backlog), un vrai
avertissement est apparu : `public_bucket_allows_listing`. Le bucket
`photos` est marqué `public = true`, ce qui suffit pour que
`getPublicUrl()` (seule méthode utilisée par `app/create/page.tsx`, vérifié
par recherche dans tout le code — aucun `.list()` ni `.download()`) serve
les fichiers via `/storage/v1/object/public/photos/...`, une route qui ne
consulte pas les RLS. La policy SELECT large en plus de ce flag public ne
servait donc qu'à une chose : permettre à n'importe qui d'énumérer
*tout* le contenu du bucket via l'API de listing (`/storage/v1/object/list/
photos` ou le SDK `.list()`), y compris les photos de cachettes privées ou
déjà expirées — que le design du jeu voulait accessibles uniquement via
leur lien/code, jamais par simple navigation. Changement 100% base de
données (une seule policy supprimée), zéro impact sur les quotas
Supabase/Vercel, aucune régression sur l'affichage des photos (confirmé via
`get_advisors` post-migration : le warning a disparu ; `npm run build`
passe). Aucune règle de jeu modifiée. Item de sécurité traité en priorité
sur le backlog, conformément à la règle de priorisation de la routine ; le
backlog (rappel de suivi manuel des quotas, index composite conditionnel —
non pertinent vu le volume actuel de 6 `hides`/8 `attempts`) reste
inchangé pour la prochaine exécution.

## 2026-08-02

**UX : indicateur "cachette active" visible sur toute la nav.**

- `supabase/migrations/009_has_active_hide.sql` : nouvelle RPC
  `has_active_hide(p_creator_id text) returns boolean`, `security definer`,
  simple `exists()` sur `hides(creator_id, status, expires_at)`.
- `components/NavBar.tsx` : appel de cette RPC au montage (une fois par
  session, la nav étant montée dans `app/layout.tsx` et ne se démontant pas
  entre les navigations client-side), affichage d'un petit point vert sur
  l'icône 📸 Hide quand `hasActiveHide` est vrai et que l'onglet n'est pas
  déjà actif.

Pourquoi : c'était le seul item de code encore présent dans le backlog.
Jusqu'ici, la seule façon de savoir qu'on avait déjà une cachette active
était d'ouvrir `/create`, qui affiche alors l'écran dédié avec le
countdown/le code privé — mais rien ne le rappelait ailleurs dans l'app
(sur `/play` ou `/leaderboard` par exemple), alors que la règle « une seule
cachette active à la fois » peut surprendre un joueur qui tente de
republier. Une RPC dédiée plutôt que la réutilisation de
`get_my_active_hide` existante : cette dernière calcule aussi les compteurs
`total_attempts`/`finds` via deux sous-requêtes supplémentaires inutiles
pour un simple badge, et n'est jusqu'ici appelée que sur `/create` — en
faire une dépendance globale de la nav (donc de toutes les pages) aurait
propagé ce coût à chaque page vue. `has_active_hide` s'appuie sur l'index
partiel unique déjà existant `uniq_active_hide_per_creator(creator_id) where
status = 'active'`, donc l'`exists()` est un index-only scan — négligeable
sur le quota compute Free tier, même appelé une fois par session sur
n'importe quelle page. Aucune donnée de position ni photo exposée, aucune
règle de jeu modifiée.

## 2026-08-01

**Correctif UX : erreurs réseau/API masquées en faux état "vide" sur `/play` et `/leaderboard`.**

- `app/play/page.tsx` : `fetchHides` ignorait l'`error` retourné par la
  requête Supabase (`const { data } = await q;`), donc un échec réseau ou
  une panne côté Supabase affichait silencieusement « No active hides
  yet. » comme si le feed était réellement vide. Ajout d'un état `error`
  et d'une carte dédiée « ⚠️ Couldn't load hides. » avec bouton « Try
  again » qui relance `fetchHides()`.
- `app/leaderboard/page.tsx` : même problème sur l'appel RPC
  `get_leaderboard`, affichant « No one on the board yet. » en cas
  d'échec. Fetch extrait dans `fetchBoard()` (réutilisable), même carte
  d'erreur avec bouton « Try again ».

Pourquoi : en auditant le backlog, l'item du jour (« mettre en avant la
ligne du joueur courant sur `/leaderboard` ») s'est avéré déjà implémenté
depuis le commit MVP initial (`r.player_id === me` avec fond ambré et
libellé « (you) », présents dans `app/leaderboard/page.tsx` depuis le
début) — item retiré du backlog sans travail à faire. En cherchant la
prochaine amélioration prioritaire, un vrai bug de correction est apparu :
deux des trois pages de données (`/play`, `/leaderboard`) n'avaient aucune
gestion d'erreur sur leurs appels Supabase, contrairement à
`HideGame.tsx`/`PrivatePlay.tsx` qui gèrent déjà proprement `error`. Un
joueur en coupure réseau ou pendant un incident Supabase voyait un état
« vide » trompeur au lieu de comprendre que le chargement avait échoué.
Changement 100% front (gestion d'erreur uniquement), aucune nouvelle
requête, RPC, ni dépendance ; aucun impact sur les quotas, les règles de
jeu, ou la sécurité (aucune donnée supplémentaire exposée).

## 2026-07-31

**Accessibilité : respect de `prefers-reduced-motion` sur les animations `animate-pulse`.**

- `app/globals.css` : ajout d'une règle `@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none; } }`.
  Couvre en un seul endroit les 3 usages existants de la classe utilitaire
  Tailwind `animate-pulse` dans l'app : les squelettes de chargement de
  `app/play/page.tsx` et `app/leaderboard/page.tsx` (ajoutés les 2026-07-23
  et 2026-07-24), et le halo pulsant du cercle de révélation dans
  `components/HideGame.tsx` affiché quand un joueur trouve la cachette.

Pourquoi : c'était le prochain item de code du backlog. Les animations de
pulsation continue peuvent gêner ou provoquer un inconfort chez les joueurs
sensibles au mouvement (vestibular disorders), qui expriment cette
préférence via le paramètre système `prefers-reduced-motion`. Une seule
règle CSS globale ciblant la classe utilitaire suffit à couvrir tous les
usages actuels et futurs de `animate-pulse`, sans toucher aux composants
eux-mêmes. Changement 100% front (CSS uniquement), aucune nouvelle requête
ni dépendance, zéro impact sur les quotas Supabase/Vercel. Aucune règle de
jeu ni sécurité touchée.

Backlog : il ne reste que la mise en avant du joueur courant sur le
leaderboard comme item de code, et le rappel de suivi manuel des quotas
Supabase.

## 2026-07-30

**Accessibilité : `aria-label` manquant sur les swatches de couleur de `/create`.**

- `app/create/page.tsx` : les boutons de presets de camouflage
  (`COLOR_PRESETS`, ronds de couleur unie sans aucun texte ni `alt`)
  n'avaient qu'un attribut `title={hex}` comme nom accessible — peu ou pas
  lu par les lecteurs d'écran tactiles (VoiceOver/TalkBack n'affichent pas
  de tooltip au clic). Ajout de `aria-label={"Use color " + hex}` sur
  chacun de ces boutons.

Pourquoi : c'était le premier item de code du backlog (aria-labels sur les
boutons icône-seule). Un audit complet des `<button>` de `app/` et
`components/` a montré que les boutons initialement visés par cet item
(🔄 refresh sur `/play`, 🔗 Share/🚩 Report sur `HideGame.tsx`) avaient déjà
un nom accessible (aria-label existant ou texte visible) lors d'une
précédente exécution ; les swatches de couleur de `/create` étaient le seul
vrai bouton icône-seule (ici couleur-seule) sans nom accessible fiable dans
toute l'app. Changement 100% front, une seule ligne ajoutée par bouton,
aucune dépendance, aucune nouvelle requête, `npm run build` passe. Aucune
règle de jeu ni sécurité touchée.

## 2026-07-29

**UX mobile : retour haptique léger sur tentative trouvée/ratée.**

- `components/HideGame.tsx` : nouveau helper `vibrate(pattern)` qui appelle
  `navigator.vibrate` s'il existe (vérification de présence + `try/catch`,
  totalement silencieux sinon — notamment sur iOS Safari, qui n'implémente
  pas cette API). Appelé dans `submitAttempt` juste après réception du
  résultat serveur : double vibration courte (`[15, 60, 15]`) sur succès,
  vibration brève (`20`) sur échec.

Pourquoi : dernier item de code du backlog. Avec seulement 3 tentatives/jour
et beaucoup de jeu au pouce sur mobile (pincer/zoomer puis taper), un léger
retour physique confirme immédiatement le résultat sans devoir lire le texte
de feedback affiché juste en dessous. Changement 100% front, API native du
navigateur (`Vibration API`), aucune dépendance ajoutée, aucune nouvelle
requête ni RPC : zéro impact sur les quotas Supabase/Vercel. Aucune règle de
jeu ni sécurité touchée (le résultat vibré est celui déjà renvoyé par
`try_attempt` côté serveur, rien n'est calculé côté client).

Backlog : vidé de son dernier item de code, complété avec 3 nouvelles idées
(labels d'accessibilité sur les boutons icône-seule, respect de
`prefers-reduced-motion` sur les squelettes/halo, mise en avant du joueur
courant sur le leaderboard) pour les prochaines exécutions.

## 2026-07-28

**Gameplay : filtre « Hide tried/found » sur le feed `/play`.**

- `app/play/page.tsx` : nouveau bouton toggle « 🙈 Hide tried/found » à côté
  des tris existants (Newest/Hardest/Expiring). Quand activé, masque de
  l'affichage les cachettes déjà marquées `attempted` ou `found` par le
  joueur courant — calcul 100% côté client à partir de `statuses`, déjà
  chargé via la RPC `get_hide_statuses` existante (aucune nouvelle requête
  ni RPC). Préférence retenue en `localStorage` (`zh_hide_done`) pour
  persister entre les visites. Quand le filtre ne laisse aucune cachette
  visible sur la page courante, un message dédié invite à le désactiver au
  lieu d'afficher une grille vide silencieuse.

Pourquoi : les badges ✅ Found / 👀 Tried (ajoutés le 2026-07-18) signalent
déjà les cachettes déjà jouées, mais un joueur régulier avec beaucoup
d'historique doit quand même les parcourir visuellement pour trouver les
cachettes fraîches. Ce filtre, dernier item de code du backlog, permet de
les masquer directement. Changement 100% front, aucune nouvelle requête ni
RPC, zéro impact sur les quotas Supabase/Vercel. Aucune règle de jeu ni
sécurité touchée (le filtrage n'affecte que ce qui est déjà chargé côté
client ; le calcul de succès et la position du sticker restent
exclusivement côté serveur). Le filtre s'applique uniquement à la page
courante du feed paginé (il ne déclenche pas de chargement supplémentaire
pour « remplir » la grille si beaucoup de cachettes sont masquées) —
comportement acceptable vu la taille des pages (20) et signalé plutôt que
caché, via le message dédié.

Backlog : il ne reste que le retour haptique mobile (`navigator.vibrate`)
comme item de code, et le rappel de suivi manuel des quotas Supabase.

## 2026-07-27

**UX : feedback visuel « Copié ! » sur les boutons de copie de lien de `/create`.**

- `app/create/page.tsx` : nouvel état `copiedKey` et helper `copyLink(key, text)`
  partagés par les 3 boutons de copie existants — « Copy direct link (no code
  shown) » (cachette privée fraîchement publiée), « Copy game link »
  (cachette publique fraîchement publiée), et « Copy private link »
  (cachette privée déjà active). Chaque bouton affiche « ✅ Copied! » à la
  place de son libellé pendant 1.5s après le clic, avant de revenir à son
  texte normal.

Pourquoi : ces boutons copiaient déjà silencieusement le lien dans le
presse-papier via `navigator.clipboard`, sans aucune confirmation visuelle —
contrairement au bouton de partage ajouté hier sur l'écran de jeu
(`HideGame.tsx`), qui affiche « ✅ Link copied! ». Un joueur qui clique sans
retour ne sait pas si l'action a fonctionné et reclique parfois plusieurs
fois. Changement 100% front, réutilise le même pattern (`setTimeout` +
état local) déjà en place : aucune nouvelle requête ni RPC, zéro impact sur
les quotas Supabase/Vercel, aucune règle de jeu ni sécurité touchée.
Dernier item de code du backlog retiré dans `ROADMAP.md` (il reste le
filtre « déjà tenté/trouvé » sur le feed, le retour haptique mobile, et le
rappel de suivi manuel des quotas).

## 2026-07-26

**UX : bouton de partage direct sur l'écran de jeu (`🔗 Share this hide`).**

- `components/HideGame.tsx` : nouveau bouton à côté de « 🚩 Report this
  hide », qui partage l'URL de la cachette actuellement affichée. Utilise
  `navigator.share` (feuille de partage native) quand disponible — sinon
  copie l'URL dans le presse-papier via `navigator.clipboard`, avec un
  texte de confirmation « ✅ Link copied! » affiché 1.5s à la place du
  libellé du bouton. Aucun échec silencieux bloquant si le presse-papier
  n'est pas accessible (contexte non sécurisé, permission refusée).

Pourquoi : jusqu'ici, le seul moyen de partager le lien d'une cachette
précise était la barre d'URL du navigateur, ou l'écran de publication vu
une seule fois par le créateur juste après avoir créé sa cachette
(`app/create/page.tsx`). Un joueur qui tombe sur une cachette difficile
depuis le feed public, ou qui veut défier un ami sur la cachette privée
qu'il est en train de jouer, n'avait aucun bouton dédié pour ça. Changement
100% front (réutilise `window.location.href`, aucune nouvelle requête ni
RPC) : zéro impact sur les quotas Supabase/Vercel. Aucune règle de jeu ni
sécurité touchée — le lien partagé est déjà celui affiché dans la barre
d'adresse du joueur, aucune position de sticker ni donnée serveur
supplémentaire n'est exposée.

Backlog complété avec 3 nouvelles idées (feedback « Copié ! » sur les
boutons existants de `/create`, filtre « masquer déjà tenté/trouvé » sur le
feed, retour haptique léger sur tentative) pour les prochaines exécutions.

## 2026-07-25

**Perf : pagination du feed `/play` (chargement par pages de 20).**

- `app/play/page.tsx` : remplacement du `limit(60)` fixe par un chargement
  paginé via `.range()`, page de `PAGE_SIZE = 20` cachettes. Un bouton
  « Load more » apparaît sous la grille tant qu'une page pleine a été
  reçue (`hasMore`), avec un état de chargement séparé (`loadingMore`) qui
  n'affecte ni le squelette initial ni le rafraîchissement manuel. Un tri
  secondaire par `id` a été ajouté à la requête pour stabiliser l'ordre des
  pages (évite les doublons/sauts si une nouvelle cachette est créée entre
  deux chargements). Le changement de tri (Newest/Hardest/Expiring) et le
  rafraîchissement manuel repartent bien de la première page.

Pourquoi : le feed chargeait jusqu'à 60 cachettes (avec vignettes) dès
l'arrivée sur `/play`, même quand seules les premières étaient visibles à
l'écran — inutile sur mobile, en particulier sur connexion lente. La
pagination réduit le transfert initial (20 vignettes au lieu de 60) tout en
gardant l'accès au reste du feed via un geste explicite. Changement 100%
front, aucune nouvelle RPC ni migration (la vue `active_hides` existante
supporte déjà `.range()`), donc pas d'impact sur les quotas Supabase/Vercel.
Aucune règle de jeu ni sécurité touchée (RLS et calcul serveur inchangés).
Item retiré du backlog dans `ROADMAP.md` (dernier item de code du backlog,
il ne reste que le rappel de suivi manuel des quotas).

## 2026-07-24

**UX : squelette de chargement (skeleton) sur `/leaderboard`.**

- `app/leaderboard/page.tsx` : remplacement du texte « Loading… » par un
  squelette (`animate-pulse`) qui reprend la forme réelle du contenu — 3
  blocs de podium (avatar rond, nom, score, colonne de hauteur variable) et
  5 lignes de classement (rang, avatar, nom, score) — affiché pendant le
  chargement initial et à chaque changement de filtre (board/period).

Pourquoi : même constat que pour le feed `/play` la veille — un texte centré
« Loading… » crée un flash de contenu vide à chaque changement de filtre
(Top Hiders/Seekers, This week/All-time), qui recharge systématiquement les
données. Le squelette donne un repère visuel immédiat de la mise en page
(podium + liste) et rend les changements de filtre moins abrupts. Changement
100% front (CSS/JSX uniquement, aucune nouvelle requête ni RPC) : zéro
impact sur les quotas Supabase/Vercel, aucune règle de jeu ni sécurité
touchée (calcul de score toujours via `get_leaderboard` côté serveur, RLS
inchangé).

## 2026-07-23

**UX : squelette de chargement (skeleton) sur le feed `/play`.**

- `app/play/page.tsx` : remplacement du texte « Loading… » par une grille de
  6 cartes squelette (`animate-pulse`, mêmes proportions que les vraies
  cartes : vignette carrée, avatar rond, deux lignes de texte) affichée
  pendant le premier chargement du feed (`loading === true`). Le
  rafraîchissement manuel (bouton 🔄, état `refreshing`) est inchangé et ne
  déclenche pas ce squelette, pour ne pas vider la grille existante.

Pourquoi : le feed public est la première chose vue en arrivant sur `/play`,
et un simple texte centré crée un flash de contenu vide peu engageant sur
mobile, en particulier sur connexion lente. Le squelette donne un repère
visuel immédiat de la mise en page à venir. Changement 100% front (CSS/JSX
uniquement, aucune nouvelle requête ni RPC) : zéro impact sur les quotas
Supabase/Vercel, aucune règle de jeu ni sécurité touchée (calcul de succès
et position du sticker toujours côté serveur, RLS inchangé).

## 2026-07-22

**UX : bouton de rafraîchissement manuel sur le feed `/play`.**

- `app/play/page.tsx` : extraction de la logique de chargement du feed
  (requête `active_hides` + RPC `get_hide_statuses`) dans une fonction
  `fetchHides`, réutilisée par le `useEffect` initial et par un nouveau
  bouton 🔄 placé à côté du titre « Active hides ». Le bouton utilise un état
  `refreshing` distinct du `loading` initial, pour ne pas vider/masquer la
  grille pendant un rafraîchissement manuel (juste une icône qui tourne,
  bouton désactivé le temps de la requête).

Pourquoi : le feed ne se recharge qu'au montage de la page ou au changement
de tri ; un joueur qui reste dessus (ou qui vient de créer/retenter une
cachette dans un autre onglet) n'a aucun moyen de revoir l'état à jour sans
recharger toute la page. Changement 100% front : réutilise exactement les
mêmes appels réseau existants (pas de nouvelle requête, pas de nouvelle RPC),
donc aucun impact sur les quotas Supabase/Vercel. Aucune règle de jeu ni
sécurité touchée (le calcul de succès et la position du sticker restent
côté serveur, RLS inchangé).

## 2026-07-21

**UX : countdown « reset dans Xh Ym » quand les tentatives du jour sont épuisées.**

- `components/HideGame.tsx` : nouveau hook `useResetCountdown`, qui calcule
  côté client le temps restant jusqu'à minuit UTC (rafraîchi toutes les 30s,
  actif uniquement quand `attempts_left === 0` et que le joueur n'a pas
  trouvé/n'est pas le créateur). Le message « No attempts left today » affiche
  désormais « Reset in Xh Ym. » au lieu du texte générique « Come back
  tomorrow! » (ce dernier reste utilisé en repli si le calcul n'a pas encore
  tourné, ou si le sticker est révélé après le dernier essai raté).

Pourquoi : la limite de 3 tentatives/jour/cachette se réinitialise à minuit
UTC (`current_date` dans les RPC `try_attempt`/`get_hide_detail`), mais le
joueur n'avait aucune indication du délai réel avant de pouvoir retenter —
« demain » est vague selon l'heure et le fuseau du joueur. Changement 100%
front (un `setInterval` léger, aucun nouvel appel réseau), aucune règle de
jeu modifiée (toujours 3 tentatives/jour, calcul de succès et position
toujours côté serveur), aucun impact sur les quotas Supabase/Vercel.

## 2026-07-20

**Gameplay : repères visuels des tentatives ratées sur la photo.**

- `components/HideGame.tsx` : chaque tentative ratée est maintenant marquée
  sur la photo par un petit anneau coloré (rouge = très proche, orange =
  chaud, jaune = tiède, bleu = froid), basé sur la `distance` déjà renvoyée
  par `try_attempt`. Un court texte d'aide apparaît sous le feedback dès la
  première tentative ratée. L'historique est gardé en mémoire côté client
  pour la session de jeu en cours (reset à chaque chargement/nouvelle
  cachette) — aucune tentative n'est modifiée ou re-stockée en base.

Pourquoi : avec seulement 3 tentatives/jour/cachette, un joueur oubliait
souvent où il avait déjà tapé et retapait une zone déjà écartée. Ce repère
aide à raisonner spatialement sans changer les règles du jeu (toujours 3
tentatives, calcul de succès inchangé, aucune position exposée avant la
victoire). Changement 100% front, aucune nouvelle RPC ni colonne : zéro
impact sur les quotas Supabase/Vercel, et aucun changement de sécurité (le
serveur reste seul à connaître la position réelle tant que la cachette
n'est pas trouvée).

## 2026-07-19

**UX : modale in-app pour « Signaler cette cachette » au lieu de `prompt()`/`alert()`.**

- `components/HideGame.tsx` : le bouton « 🚩 Report this hide » ouvre
  désormais une petite modale (overlay + carte `zh-card`, cohérente avec le
  reste du design) au lieu du `window.prompt()`/`window.alert()` natifs du
  navigateur. Le joueur saisit son motif dans un `<textarea>`, avec un état
  d'envoi et un message de confirmation dans la modale elle-même. Annulable
  en cliquant en dehors ou sur « Cancel ».

Pourquoi : les popups natifs `prompt`/`alert` sont bloquants, mal stylés,
et offrent une mauvaise expérience sur mobile (notamment iOS Safari où ils
peuvent être discrets ou tronqués). Une modale in-app est plus lisible et
cohérente avec le reste de l'UI. Changement purement front (aucun nouvel
appel RPC, la fonction `report_hide` existante est réutilisée telle quelle) :
aucun impact sur la sécurité, les règles de jeu, ou les quotas
Supabase/Vercel.

## 2026-07-18

**Ajout : badge « déjà tenté » / « déjà trouvé » sur le feed.**

- `supabase/migrations/008_hide_status_batch.sql` : nouvelle RPC
  `get_hide_statuses(p_hide_ids uuid[], p_player_id text)`, security definer,
  qui renvoie un objet JSON `{hide_id: "attempted" | "found"}` limité aux
  cachettes où le joueur a au moins une tentative (les autres sont simplement
  absentes de la réponse). Aucune position exposée, un seul appel groupé par
  chargement du feed (pas une requête par carte).
- `app/play/page.tsx` : appel de cette RPC juste après le chargement du feed
  (avec les ids déjà récupérés), affichage d'un badge ✅ Found / 👀 Tried en
  bas à droite de chaque carte.

Pourquoi : évite au joueur de perdre du temps à retaper une cachette déjà
jouée ou déjà trouvée, surtout utile avec la limite de 3 tentatives/jour.
Impact quotas : un seul appel RPC par visite du feed (max 60 ids), coût de
calcul négligeable (jointure indexée sur `attempts(hide_id, player_id)`),
aucun changement de schéma de table. Sécurité inchangée : RLS toujours
strict sur `hides`/`attempts`, la position réelle n'est jamais renvoyée par
cette fonction.

## 2026-07-17

**Ajout : aperçu de partage (Open Graph / Twitter Card).**

- `app/layout.tsx` : ajout de `metadataBase`, `openGraph` et `twitter` dans
  les metadata Next.js (titre, description, image 1200x630).
- `public/og-image.png` : image statique générée hors-ligne (aucune route
  serveur, aucun coût de compute), reprenant le thème visuel de l'app
  (dégradé violet, formes indices, tagline).

Pourquoi : le jeu est pensé pour être partagé en bio Instagram et par lien
direct (DM, autres réseaux). Sans balises OG, un lien collé n'affiche aucun
aperçu et perd en attractivité. Ce changement est purement front (metadata +
un asset statique) : aucun impact sur les règles de jeu, la sécurité RPC/RLS,
ou les quotas Supabase/Vercel.
