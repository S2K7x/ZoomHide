# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

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
