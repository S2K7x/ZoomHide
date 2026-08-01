# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

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
