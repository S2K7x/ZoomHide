# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

## 2026-07-17 (2)

**Ajout : cachettes privées par code à 6 chiffres (style Kahoot).**

- Choix `public`/`private` à la création (`create_hide()` génère le code
  côté serveur, retry sur collision — négligeable vu 1M de combinaisons).
- Nouvelle vue filtrée : `active_hides` exclut désormais `visibility <>
  'public'` (aucune policy RLS supplémentaire nécessaire, la table `hides`
  reste 100% verrouillée pour anon/authenticated comme avant).
- Nouvelle RPC `get_hide_by_code(p_code, p_player_id)`, rate-limitée à 10
  essais/heure/IP via une table `code_attempts` + la fonction
  `request_ip_hash()` (IP lue depuis le header PostgREST, pas de client
  fourni — un identifiant client serait trivialement contournable).
  Réponse générique (`not_found`) pour un code mal formé ou inexistant.
- Nouvelles routes `/play/private` (saisie de code) et
  `/play/private/[code]` (résolution auto + jeu, via un composant
  `HideGame` extrait de l'ancienne page `/play/[hideId]` pour éviter la
  duplication).
- Migration : `supabase/migrations/003_private_hides.sql`.

Pourquoi : demande explicite pour un mode "entre amis" — cacher quelque
chose que seuls des proches choisis peuvent chercher, sans polluer le feed
public. Les règles de jeu existantes (1 cachette active, 3 essais/jour,
expiration 7 jours, badges) s'appliquent à l'identique aux deux visibilités.

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
