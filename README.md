# 🔎 Zoom Hide

Jeu asynchrone mobile-first : cache un sticker dans une photo de ta vraie vie,
tes followers zooment pour le retrouver. Pensé pour être partagé en bio
Instagram, et pour tourner **100% gratuitement** (Vercel Hobby + Supabase Free).

## Stack

- **Next.js (App Router)** — pages 100% client-side, aucune API route (zéro compute Vercel Functions)
- **Supabase** — Postgres + Storage. Toute la logique sensible est dans des
  fonctions RPC `security definer` (calcul du succès, limite 3 essais/jour,
  1 cachette active max)
- **Zéro lib externe** pour le zoom/pan (Pointer Events + CSS transform), la
  compression d'image (`<canvas>`) et l'image de partage story 9:16 (`<canvas>`)

## Sécurité (anti-triche)

- La position du sticker (`pos_x/pos_y`) **n'est jamais envoyée au client**
  avant une tentative. Le feed lit une vue `active_hides` qui exclut ces colonnes.
- Le succès est calculé **côté serveur** par la RPC `try_attempt()` ; les tables
  sont verrouillées par RLS sans aucune policy anon (aucun accès direct).
- La règle « 1 cachette active max » est garantie par un index unique partiel
  en plus du check dans `create_hide()`.
- Le re-encodage canvas supprime les métadonnées EXIF (dont la géolocalisation).
- Bouton « Signaler » sur chaque cachette → table `reports` à reviewer à la main.

### Cachettes privées par code (style Kahoot)

- À la création, le joueur choisit `public` (feed) ou `private` (code à 6
  chiffres, `000000`-`999999`, généré côté serveur dans `create_hide()`).
- Une cachette privée n'apparaît **jamais** dans `active_hides` : la vue
  filtre `visibility = 'public'`. Comme la table `hides` reste entièrement
  verrouillée pour anon/authenticated (`revoke all`), il n'y a pas besoin
  d'une policy RLS dédiée — la vue est le seul point de lecture public.
- Résolution d'un code via `get_hide_by_code(p_code, p_player_id)`, rate-limitée
  à **10 essais/heure/IP** (table `code_attempts`, purgée après 2h par le cron
  horaire existant). Réponse volontairement générique (`not_found`) qu'un code
  soit mal formé ou simplement inexistant/expiré, pour ne rien apprendre à un
  bruteforce.
- L'IP est récupérée **côté Postgres**, via le header transmis par PostgREST
  (`request.headers->>'x-forwarded-for'`, fonction `request_ip_hash()`) — pas
  besoin d'une Vercel Function pour ça. C'est un choix délibéré : un
  identifiant fourni par le client (ex. l'UUID `localStorage`) serait trivialement
  contournable en le faisant varier à chaque appel RPC, ce qui viderait le rate
  limit de son sens. Limite connue : sans edge de confiance dédiée devant
  Postgres, ce header reste un signal *best-effort* (fiable en pratique derrière
  l'infra Supabase, mais pas une garantie cryptographique d'unicité d'IP).

## Installation

```bash
npm install
cp .env.example .env.local   # puis remplis les 2 variables
npm run dev
```

### Variables d'environnement

| Variable | Où la trouver |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API Keys → publishable key (`sb_publishable_...`) |

## Setup Supabase

Le schéma complet est dans [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
(tables, RLS, RPC, bucket Storage `photos`, jobs `pg_cron`).

> ✅ Déjà appliqué sur le projet `ghnnkwpitmlqxkmpkunn`. Pour un nouveau projet :
> Dashboard → SQL Editor → colle le contenu du fichier → Run.

Jobs pg_cron installés :
- `expire-hides` (toutes les heures) : passe en `expired` + attribue les badges
  (`perfect_hide` / `easy` / `hard` / `legendary`)
- `cleanup-photos` (3h30 chaque nuit) : supprime les photos des cachettes
  expirées/supprimées depuis plus de 30 jours

## Déploiement Vercel

1. Pousse le repo sur GitHub.
2. [vercel.com/new](https://vercel.com/new) → importe le repo (framework Next.js
   auto-détecté, rien à configurer).
3. Ajoute les 2 variables d'environnement ci-dessus (Production + Preview).
4. Deploy. Mets l'URL en bio Instagram 🎉

## Gameplay

- 1 cachette active max par joueur (publique **ou** privée, jamais les deux),
  expire après **7 jours**
- Cachette **publique** : visible dans le feed `/play`. Cachette **privée** :
  jamais dans le feed, accessible uniquement via un code à 6 chiffres partagé
  par le cacheur (DM, story fermée…) sur `/play/private/[code]`
- **3 essais par jour** et par cachette (reset quotidien)
- Personne ne trouve en 7 jours → badge **Cachette Parfaite 💎** (+500 pts)
- Score cacheur : 10 pts par tentative ratée provoquée + bonus parfaite
- Score chercheur : 100 pts par trouvaille, malus vitesse (−1/s, cap 50) et
  ratés préalables (−25)
- Leaderboards hebdo (reset lundi) + all-time
- Identité : UUID généré côté client, stocké en `localStorage` (pas de compte)

## Limites connues (MVP)

- Pas de compte → changer de navigateur = nouveau joueur ; un tricheur peut
  vider son localStorage pour reset ses 3 essais (acceptable pour un jeu entre
  followers).
- Le nettoyage storage supprime les métadonnées des objets ; vérifie de temps
  en temps l'usage réel du bucket dans le dashboard.
- Modération manuelle : table `reports` à consulter dans le dashboard.
