-- Sécurité (durcissement) : la vue `active_hides` — le feed public, lisible par
-- `anon` via PostgREST — portait tous les droits d'écriture pour `anon` et
-- `authenticated` (`insert`, `update`, `delete`, plus `truncate`, `references`,
-- `trigger`), hérités du `grant all on all tables in schema public` par défaut
-- de Supabase appliqué aux nouveaux objets du schéma. Seul le `select` est
-- utilisé par l'app (`app/play/page.tsx`).
--
-- Aujourd'hui ces droits sont inertes : la vue contient des agrégats
-- (`count(*)`, `sum(...)` sur `attempts`), donc Postgres la déclare non
-- modifiable — `information_schema.views.is_updatable = 'NO'` — et toute
-- écriture est rejetée avant même le contrôle des droits.
--
-- Mais la vue est `security definer` (propriétaire `postgres`, donc exécutée
-- avec ses droits, hors RLS) : une future migration qui la simplifierait au
-- point de la rendre auto-modifiable (suppression des agrégats, passage par une
-- table de compteurs, etc.) transformerait silencieusement ces grants en un
-- chemin d'écriture direct sur `hides`, contournant la RLS et les contrôles de
-- propriété des RPC (`delete_hide`, `create_hide`). Le filet est retiré
-- maintenant, pendant qu'il ne casse rien, plutôt que d'espérer que la
-- migration en question y pense.
--
-- Correctif : ne laisser que le `select` sur la vue. Le rôle `postgres` et
-- `service_role` ne sont pas touchés.

-- `revoke all` puis `grant select` plutôt qu'une liste de privilèges à révoquer :
-- c'est idempotent, et ça couvre aussi `maintain` (PostgreSQL 17), qui autorise
-- `vacuum`/`analyze`/`reindex`/`cluster` sur l'objet — inatteignable via
-- PostgREST (qui n'émet que des `select` et des appels de RPC), mais sans usage
-- légitime ici non plus.
revoke all on public.active_hides from anon, authenticated;
grant select on public.active_hides to anon, authenticated;

-- Filet supplémentaire pour les objets créés plus tard dans ce schéma : les
-- default privileges de Supabase (positionnés par le rôle `postgres`, celui qui
-- crée les objets via les migrations) ne donnent plus que `select` à `anon` et
-- `authenticated`. Une future table/vue du schéma `public` ne naîtra donc plus
-- avec des droits d'écriture publics — la RLS reste le contrôle principal, ceci
-- n'est qu'une deuxième barrière.
--
-- Attention pour les prochaines migrations : ceci ne concerne que les *tables*
-- et *vues*. Les nouvelles *fonctions* héritent toujours d'un `execute` pour
-- `anon`/`authenticated` (default privileges Supabase), d'où le contrôle
-- récurrent inscrit au backlog après chaque migration qui ajoute une fonction.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  grant select on tables to anon, authenticated;
