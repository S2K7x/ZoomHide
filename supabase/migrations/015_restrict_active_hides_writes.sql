-- 2026-08-16 : durcissement des droits d'écriture du schéma public.
--
-- Migration appliquée en base ce jour-là (`supabase_migrations.schema_migrations`,
-- version 20260816020847, nom `restrict_active_hides_writes`) mais jamais
-- commitée dans le repo — reconstituée ici le 2026-08-18 à partir de la base
-- pour que `supabase/migrations/` puisse rejouer l'état réel du projet.
--
-- Le premier `revoke` visait des grants `insert`/`update`/`delete` supposés
-- présents sur la vue `active_hides` : le contrôle du 2026-08-17 sur
-- `pg_class.relacl` a montré qu'ils n'ont jamais existé (fausse alerte née
-- d'une lecture d'`information_schema.table_privileges`). Il est donc sans
-- effet, et conservé tel quel — il ne coûte rien et documente le contrôle.
--
-- Le second est un vrai garde-fou, toujours utile : les default privileges
-- Supabase accordent l'écriture à `anon`/`authenticated` sur toute NOUVELLE
-- table ou vue créée par `postgres` dans `public`. Cette ligne les retire à la
-- source, donc une future migration qui ajoute une table ne repart plus d'un
-- état ouvert par défaut. (Le `select` reste accordé : c'est ce dont la vue
-- `active_hides` a besoin pour le feed public.)

revoke insert, update, delete, truncate, references, trigger
  on public.active_hides from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;
