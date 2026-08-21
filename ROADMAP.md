# Roadmap — Zoom Hide

Petit backlog vivant, alimenté par la routine quotidienne automatisée.
Règle : une seule amélioration livrée par jour, petite et testée.

## Backlog

- **Fiabilité / coût (priorité HAUTE, découvert le 2026-08-18) :
  `cleanup_old_photos()` n'a JAMAIS fonctionné.** Le job cron `cleanup-photos`
  échoue à chaque exécution depuis le 2026-07-17 — 32 exécutions, 32 échecs,
  0 succès (`select * from cron.job_run_details`). Cause : Supabase interdit
  désormais le `delete from storage.objects` en SQL via le trigger
  `storage.protect_delete()` (`ERROR 42501: Direct deletion from storage tables
  is not allowed. Use the Storage API instead.`). Conséquence : aucune photo
  n'a jamais été supprimée du bucket `photos`, ni les anciennes (règle des
  30 jours), ni les orphelines. Les deux autres jobs cron vont bien
  (`expire-hides` : 776 succès, `cleanup-code-attempts` : 31 succès) — le
  gameplay n'est pas touché, c'est uniquement le quota Storage qui grossit
  sans jamais être purgé.
  Correctif possible : passer la suppression par la Storage API, dans une Edge
  Function Supabase (elle reçoit `SUPABASE_SERVICE_ROLE_KEY` en variable
  d'environnement injectée, donc aucun secret à stocker en base) qui
  supprimerait à la fois les photos des cachettes anciennes et les orphelines.
  **Point bloquant à trancher manuellement : comment la déclencher une fois par
  jour sans ouvrir une surface publique.** `pg_net` n'est pas installé, donc
  pg_cron ne sait pas faire d'appel HTTP en l'état ; et une Edge Function en
  `verify_jwt = false` serait déclenchable par n'importe qui (levier
  d'épuisement du compute Free tier, exactement ce que `012` a fermé). Deux
  pistes : (a) `create extension pg_net` + clé service_role dans
  `vault.secrets`, appel depuis pg_cron ; (b) cron Vercel (Hobby : 1×/jour)
  sur une route `/api/cleanup-photos` protégée par `CRON_SECRET`, avec la clé
  service_role en variable d'environnement Vercel. Les deux demandent de
  provisionner un secret à la main — hors de portée de la routine quotidienne.
  Ne PAS contourner le trigger avec `set local storage.allow_delete_query =
  'true'` : cela supprimerait la ligne de métadonnées sans supprimer le fichier
  côté objet, donc sans rien libérer réellement — c'est précisément la perte de
  données que le garde-fou prévient.
- Sécurité (résiduel du correctif du 2026-08-18, à faire à la main) : les 6
  cachettes déjà en base ont un `photo_url` public dont le premier segment de
  chemin est le `player_id` du créateur — la fuite est déjà publique pour ces
  lignes-là, le correctif du jour ne vaut que pour les nouvelles publications.
  Aucune n'est active (3 `expired`, 3 `deleted`), donc plus rien à supprimer
  via `delete_hide`, mais ces `player_id` restent utilisables pour publier ou
  tenter en leur nom. À faire côté propriétaire : considérer ces identités
  comme compromises (vider `zh_player_id` du localStorage sur les appareils
  concernés pour en régénérer une), et supprimer ces 12 objets du bucket depuis
  le dashboard Storage — ce qui règle la fuite et le quota d'un même geste.
- Sécurité (process, à refaire après chaque migration qui ajoute une fonction) :
  vérifier que les nouvelles fonctions du schéma `public` ne sont pas
  exécutables par `anon`/`authenticated` sans grant explicite. Le `revoke
  execute on all functions` de `001_init.sql` ne couvre que les fonctions
  existant au moment où il tourne, et les default privileges Supabase donnent
  `execute` à `anon`/`authenticated` sur toute nouvelle fonction. Contrôle :
  `select proname, has_function_privilege('anon', oid, 'EXECUTE') from pg_proc
  where pronamespace = 'public'::regnamespace;` — comparer à la liste des RPC
  réellement appelées par l'app. **Le 2026-08-13, ce contrôle a débusqué
  `upsert_player` (grant explicite hérité du prototype, jamais appelée côté
  client) — corrigé.** À l'issue de ce contrôle, la liste des fonctions
  exécutables par `anon` doit être exactement les 11 RPC appelées par le
  client : `create_hide`, `delete_hide`, `get_hide_by_code`, `get_hide_detail`,
  `get_hide_statuses`, `get_leaderboard`, `get_my_active_hide`, `get_my_rank`,
  `has_active_hide`, `report_hide`, `try_attempt`.
  **Le 2026-08-14, ce contrôle a été étendu aux surfaces de lecture (vues,
  colonnes renvoyées par les RPC) : c'est là que se cachait la faille du jour,
  invisible pour un contrôle limité aux droits d'exécution.** Deuxième
  question à poser à chaque migration : *une sortie publique contient-elle un
  identifiant de joueur ?* Contrôle : `select * from active_hides limit 1` et
  relecture du `json_build_object` de chaque RPC — aucun `player_id` /
  `creator_id` / `reporter_id` ne doit en sortir.
  **Le 2026-08-15, les deux contrôles sont passés sans anomalie** : droits
  d'exécution `anon` exactement sur les 11 RPC listées, `active_hides` sans
  `creator_id`, RLS active et sans grant `anon` sur les 5 tables, révélation
  de la position toujours calculée côté serveur (`get_hide_detail` /
  `try_attempt`). Les avis Supabase restants (`security_definer_view` sur
  `active_hides`, `anon_security_definer_function_executable` sur les 11 RPC)
  sont attendus par conception — c'est le mode de fonctionnement du jeu sans
  authentification.
  **Le 2026-08-17, les deux contrôles sont repassés sans anomalie** (aucune
  migration depuis le 2026-08-14, état identique). Troisième contrôle ajouté
  ce jour-là, à faire sur `pg_class.relacl` et non sur
  `information_schema` : les ACL réelles des tables et vues du schéma public.
  Résultat : les 5 tables n'ont aucun grant `anon`/`authenticated` (RLS active
  sur les 5), et `active_hides` porte exactement
  `anon=r/postgres, authenticated=r/postgres` — lecture seule, aucun droit
  d'écriture. L'item de backlog qui annonçait des grants
  `insert`/`update`/`delete` sur cette vue était donc une fausse alerte
  (lecture d'`information_schema.table_privileges`, qui ne reflète pas les
  ACL effectives) — retiré, rien à révoquer.
  **Le 2026-08-18, les trois contrôles sont repassés sans anomalie, mais un
  quatrième a été ajouté — et c'est lui qui a trouvé la faille du jour.**
  Les contrôles précédents regardent les *droits* (exécution, ACL) et les
  *colonnes* renvoyées ; aucun ne regardait le *contenu* des valeurs
  renvoyées. Or `photo_url` était construit comme
  `<player_id>/<uuid>.jpg` : la colonne s'appelle `photo_url`, elle passe donc
  tous les contrôles « aucune colonne `player_id` en sortie », mais elle
  transportait l'identifiant du créateur en clair dans son chemin. Quatrième
  question à poser à chaque migration et à chaque nouvelle donnée publique :
  *une valeur publique contient-elle un identifiant en sous-chaîne* (chemin de
  fichier, URL, code, slug, nom d'objet) ? Contrôle :
  `select creator_id = split_part(split_part(photo_url,'/photos/',2),'/',1)
  from hides;` — doit être `false` partout (les lignes antérieures au
  2026-08-18 sont à `true`, voir l'item de nettoyage manuel ci-dessus).
  **Le 2026-08-19, les quatre contrôles sont repassés sans anomalie nouvelle** :
  droits d'exécution `anon` exactement sur les 11 RPC listées, RLS active et
  aucun grant `anon`/`authenticated` sur les 5 tables, `active_hides` en
  `anon=r/postgres` et sans colonne d'identifiant, aucune migration appliquée
  en base absente du repo (dernière : `20260816020847`). Le quatrième contrôle
  reste à `true` sur les 6 lignes historiques — aucune publication depuis le
  2026-07-30, donc rien de neuf : c'est l'item de nettoyage manuel ci-dessus,
  pas une régression.
  **Le 2026-08-20, les quatre contrôles sont repassés sans anomalie nouvelle**,
  état strictement identique à la veille : exécution `anon`/`authenticated` sur
  exactement les 11 RPC du client (`cleanup_old_photos`, `expire_hides`,
  `upsert_player` fermées), RLS active et `relacl` sans grant `anon` sur les
  5 tables, `active_hides` en `anon=r/postgres` avec 11 colonnes dont aucune
  d'identifiant, 15 migrations en base = 15 fichiers dans le repo (dernière :
  `20260816020847`, aucune dérive). Quatrième contrôle toujours à `true` sur
  les mêmes 6 lignes historiques, aucune nouvelle publication.
  **Le 2026-08-21, les quatre contrôles sont repassés sans anomalie nouvelle**,
  état encore identique : exécution `anon`/`authenticated` sur exactement les
  11 RPC du client (`cleanup_old_photos`, `expire_hides`, `upsert_player`
  fermées), RLS active sur les 5 tables dont les `relacl` ne portent que
  `postgres`/`service_role`, `active_hides` en `anon=r/postgres` avec 11
  colonnes sans identifiant, 15 migrations en base pour 15 fichiers dans le
  repo. Quatrième contrôle toujours à `true` sur les 6 mêmes lignes
  historiques (3 `expired`, 3 `deleted`, dernière publication le 2026-07-30).
- Sécurité (résiduel, priorité basse) : les `player_id` ne sont plus exposés
  (2026-08-14), donc l'usurpation d'identité demande maintenant de deviner un
  `crypto.randomUUID()`. Reste que les RPC continuent d'accorder des droits
  sur la simple présentation d'un `p_player_id`, sans preuve de possession :
  quiconque obtient l'id d'un joueur par un autre canal (capture réseau,
  appareil partagé, id recopié dans un partage) garde tous ses droits, sans
  révocation possible. La correction de fond serait de signer l'identité
  (jeton HMAC émis à la création du joueur, vérifié côté serveur) — trop gros
  pour une routine quotidienne, à découper. À noter aussi : `report_hide`
  n'utilise `p_reporter_id` que comme étiquette (aucun droit accordé), impact
  d'une usurpation nul.
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
- Coût (free tier, priorité moyenne — **dépend du correctif « HAUTE » en tête
  de backlog** : tant que la suppression ne passe pas par la Storage API, rien
  de ce qui suit n'est réalisable) : une publication qui échoue **après** les
  deux `supabase.storage.upload` de `app/create/page.tsx` (erreur
  `already_active`, ou erreur réseau sur `create_hide`) laisse
  `<aaaa-mm>/<uuid>.jpg` et `<uuid>_thumb.jpg` dans le bucket `photos` sans
  aucune ligne `hides` qui les référence. `cleanup_old_photos()` ne balaie que
  les photos rattachées à des cachettes anciennes : ces orphelins restent
  indéfiniment dans le quota Storage. Deux pistes : supprimer les deux objets
  dans le `catch`/la branche `already_active` de `publish()`, et/ou étendre
  `cleanup_old_photos()` aux objets sans `hides` correspondant et vieux de plus
  de 24 h (plus robuste : couvre aussi l'onglet fermé en cours d'upload).
- Code (priorité basse) : `HideGame` accepte une prop `backLabel` (valeur par
  défaut `"Feed"`, passée explicitement par `PrivatePlay`) qui n'est utilisée
  nulle part dans le rendu — le bouton retour n'affiche qu'une flèche. Soit
  l'afficher à côté de la flèche, soit retirer la prop et l'argument de
  `PrivatePlay`.
- Note (décision, pas un item) : les deux derniers appels dont l'`error` reste
  volontairement ignoré sont `get_hide_statuses` sur `/play` et `get_my_rank`
  sur `/leaderboard`. Ce sont des enrichissements secondaires : leur échec
  dégrade l'affichage (badges ou ligne « you » absents) sans jamais annoncer au
  joueur quelque chose de faux — à laisser tels quels. Tous les autres appels
  Supabase du code lisent désormais leur `error` (dernier corrigé :
  `report_hide`, le 2026-08-19).
- Note : l'index composite sur `attempts(hide_id, player_id, ...)` évoqué
  précédemment existe déjà (`idx_attempts_daily`, migration `001_init.sql`)
  — retiré du backlog, rien à faire.

## En cours

_(rien pour l'instant)_

## Fait

- **2026-08-21** — Accessibilité : le résultat d'une tentative est enfin annoncé
  aux lecteurs d'écran (`components/HideGame.tsx`). Le retour de tap (« 🔥
  Burning! So close… », « 🧊 Cold, look elsewhere. », « Network error, try
  again. »), le compteur de tentatives restantes (des pastilles `●●○`,
  illisibles à la voix) et les écrans de fin (trouvé / plus de tentatives)
  étaient rendus dans des `<p>` ordinaires, chacun dans une branche différente
  du rendu : un joueur non-voyant soumettait un tap et n'entendait
  strictement rien. Une seule région live (`role="status"`, `aria-live="polite"`,
  `aria-atomic="true"`, `sr-only`) est maintenant montée en permanence au-dessus
  des branches et porte le message complet (« 🧊 Cold, look elsewhere. 2
  attempts left today. ») ; les textes visibles correspondants passent en
  `aria-hidden` pour éviter la double lecture. Le compte à rebours de
  réinitialisation est volontairement exclu du message annoncé (il change chaque
  minute, il relancerait une annonce en boucle). Aucune migration, aucune
  requête, aucune règle de jeu touchée. Contrôle de sécurité quotidien passé
  sans anomalie le même jour (détails dans le premier item du backlog).

- **2026-08-20** — UX : squelette de chargement sur l'écran de jeu
  (`components/GameSkeleton.tsx`, utilisé par `components/HideGame.tsx` et
  `components/PrivatePlay.tsx`), dernier endroit du code à afficher un
  « Loading… » / « Unlocking hide… » en texte brut. C'est pourtant l'écran
  d'atterrissage des liens partagés : le squelette reprend la structure réelle
  du jeu (barre du haut, cadre photo, zone de contrôles) et réutilise
  exactement le cadre de `ZoomPanViewer` (ratio 1:1, `maxHeight: 72dvh`, même
  état de chargement 🔎), donc l'arrivée des données ne déplace plus rien à
  l'écran. `role="status"` + `aria-label` conservent l'information pour les
  lecteurs d'écran (« Unlocking hide » côté privé). Aucune requête, aucune
  migration, aucune règle de jeu touchée. Contrôle de sécurité quotidien passé
  sans anomalie le même jour (détails dans le premier item du backlog).

- **2026-08-19** — Fiabilité : la modale « Report this hide »
  (`components/HideGame.tsx`) ne confirme plus un signalement qui n'a pas été
  enregistré. `report_hide` était appelée sans lire l'`error` renvoyé par
  Supabase : sur coupure réseau ou panne, l'écran affichait quand même
  « Thanks, the hide has been reported » alors qu'aucune ligne `reports`
  n'était créée. Dernière occurrence du motif corrigé sur `/play` et
  `/leaderboard` le 2026-08-01 puis sur `/create` le 2026-08-17. La modale
  garde maintenant le formulaire ouvert avec un message d'erreur
  (`role="alert"`) et un bouton « Retry », le texte saisi n'est pas perdu.
  Aucune migration, aucune RPC touchée, aucun coût supplémentaire.

- **2026-08-18** — Sécurité : le chemin de stockage des photos ne contient
  plus le `player_id` du créateur (`app/create/page.tsx`). Il valait
  `<player_id>/<uuid>.jpg`, et ce chemin se retrouve tel quel dans
  `photo_url`/`thumbnail_url`, colonnes publiques du feed `active_hides` et de
  `get_hide_detail` : lire une URL du feed suffisait à récupérer l'identité du
  créateur. Or les RPC n'exigent aucune preuve de possession de l'identifiant,
  et `delete_hide(p_hide_id, p_creator_id)` prend deux valeurs qui étaient
  toutes les deux publiques (`active_hides.id` + l'id extrait de l'URL) :
  n'importe qui pouvait supprimer n'importe quelle cachette du feed, publier ou
  tenter en se faisant passer pour son créateur. Le correctif du 2026-08-14,
  qui avait retiré `creator_id` des sorties des RPC, était donc contourné par
  une simple sous-chaîne d'URL. Nouveau chemin : `<aaaa-mm>/<uuid>` — sans
  aucun lien avec le joueur (la policy `anon upload photos` de
  `storage.objects` ne contrôle que `bucket_id`, jamais le dossier : rien ne
  dépendait de cette structure). Les 6 lignes antérieures gardent leur URL et
  restent à nettoyer à la main (voir backlog).

- **2026-08-17** — Fiabilité : gestion des erreurs réseau/API sur `/create`
  (`app/create/page.tsx`), dernière page à ignorer l'`error` renvoyé par
  Supabase. `get_my_active_hide` en échec faisait passer le joueur pour
  « sans cachette active » : il repartait sur l'écran d'upload, compressait et
  téléversait deux images, et ne découvrait le problème qu'au `create_hide`
  final (`already_active`) — deux fichiers orphelins dans le bucket au passage.
  `delete_hide` en échec vidait la carte à l'écran sans que rien ne soit
  supprimé en base, et le joueur restait bloqué à la publication suivante.
  Les deux cas ont maintenant un état d'erreur explicite (écran « Try again »
  au chargement, message dans la modale de suppression), et un retour
  `not_found` de `delete_hide` resynchronise l'état depuis le serveur au lieu
  de le deviner côté client. Contrôle de sécurité quotidien passé sans
  anomalie le même jour (détails dans le premier item du backlog).

- **2026-08-15** — UX : le tri du feed `/play` (Newest/Hardest/Expiring) est
  mémorisé en `localStorage` (`zh_feed_sort`, `app/play/page.tsx`), comme le
  filtre « 🙈 Hide tried/found » déjà persistant (`zh_hide_done`) — il
  repartait sur « Newest » à chaque visite. Le premier chargement du feed est
  retardé jusqu'à la lecture des préférences (`prefsLoaded`) pour ne pas
  déclencher deux requêtes (tri par défaut puis tri mémorisé). Contrôle de
  sécurité quotidien passé sans anomalie le même jour (détails dans le
  premier item du backlog).
- **2026-08-14** — Sécurité (critique) : les identifiants de joueur ne sont
  plus exposés publiquement (`supabase/migrations/014_hide_player_ids.sql`,
  `app/leaderboard/page.tsx`). La vue `active_hides`, lisible par `anon` via
  PostgREST, renvoyait `creator_id` à côté de `id` — soit exactement le couple
  attendu par `delete_hide(p_hide_id, p_creator_id)`. Deux requêtes anonymes
  (`GET /rest/v1/active_hides?select=id,creator_id` puis
  `POST /rest/v1/rpc/delete_hide`) suffisaient donc à supprimer n'importe
  quelle cachette publique du feed, celle de n'importe quel joueur.
  Exploitation reproduite en base (transaction annulée), puis vérifiée
  inopérante après correction. Le `player_id` renvoyé par `get_leaderboard`
  (deuxième chemin vers les mêmes `creator_id`) est remplacé par un booléen
  `is_me` calculé côté serveur.
- **2026-08-13** — Sécurité : révocation du droit d'exécution `anon`/
  `authenticated`/`public` sur `upsert_player(text, text)`
  (`supabase/migrations/013_restrict_upsert_player.sql`). Elle était exposée
  via PostgREST par un `grant execute` explicite de `001_init.sql` (ligne 353)
  alors qu'aucun appel côté client ne la référence. Comme elle fait un
  `insert ... on conflict (id) do update set name = excluded.name` sans aucune
  vérification de propriété, et que `get_leaderboard` publie le `player_id`
  des 50 meilleurs joueurs, n'importe quel visiteur pouvait renommer un joueur
  du classement (pseudo affiché sur `/leaderboard`, sur les cartes du feed et
  sur l'image de partage) — et créer un nombre illimité de lignes `players`.
  Les appels internes depuis `create_hide`/`try_attempt` (security definer,
  propriétaire `postgres`) sont inchangés, vérifié en base.
- **2026-08-12** — Sécurité : révocation du droit d'exécution `anon`/
  `authenticated`/`public` sur les deux fonctions de maintenance planifiées
  `expire_hides()` et `cleanup_old_photos()`
  (`supabase/migrations/012_restrict_maintenance_functions.sql`). Elles étaient
  appelables par n'importe qui via PostgREST (`POST /rest/v1/rpc/...`) parce
  que le `revoke execute on all functions` de `001_init.sql` s'exécute avant
  leur création. `cleanup_old_photos()` est un `delete from storage.objects`,
  `expire_hides()` un `update` sur toute la table `hides` : écritures
  déclenchables par un anonyme + levier d'épuisement du compute Free tier.
  Les jobs pg_cron tournent sous `postgres`, donc inchangés ; aucune RPC de
  jeu touchée.
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
