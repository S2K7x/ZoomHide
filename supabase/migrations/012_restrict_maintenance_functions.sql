-- Sécurité : les deux fonctions de maintenance planifiées (`expire_hides`,
-- `cleanup_old_photos`) étaient exécutables par n'importe qui via PostgREST
-- (`POST /rest/v1/rpc/expire_hides`, `.../cleanup_old_photos`).
--
-- Cause : dans `001_init.sql`, le `revoke execute on all functions in schema
-- public from public, anon, authenticated` (ligne 352) est exécuté AVANT la
-- création de ces deux fonctions (lignes 379 et 401). Elles ont donc hérité du
-- `grant execute to public` par défaut de Postgres, plus les default privileges
-- Supabase (`anon`/`authenticated`), sans jamais être révoquées ensuite.
--
-- Impact : `cleanup_old_photos()` fait un `delete from storage.objects` joint
-- aux `hides` par `like '%' || o.name` (scan complet du bucket × cachettes
-- expirées à chaque appel) et `expire_hides()` un `update` sur toute la table
-- `hides` avec sous-requêtes corrélées sur `attempts`. Les deux sont donc à la
-- fois des écritures déclenchables par un anonyme et un levier d'épuisement du
-- compute du Free tier (appels illimités, aucune limite de débit côté RPC).
-- Aucune des deux n'est appelée par l'app (aucun `supabase.rpc(...)` côté
-- client ne les référence) : elles ne sont utilisées que par pg_cron.
--
-- Correctif : révocation de l'exécution pour `public`, `anon` et
-- `authenticated`. Les jobs cron `expire-hides` et `cleanup-photos` tournent
-- sous l'utilisateur `postgres` (propriétaire des fonctions), donc inchangés.

revoke execute on function public.expire_hides() from public, anon, authenticated;
revoke execute on function public.cleanup_old_photos() from public, anon, authenticated;
