# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

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
