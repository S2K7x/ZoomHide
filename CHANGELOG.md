# Changelog

Format : une entrée par jour de routine automatisée, la plus récente en haut.

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
