-- 2026-08-02 — Indicateur « cachette active » sur la nav.
-- Petite RPC dédiée pour la barre de navigation (montée une fois par session,
-- affichée sur toutes les pages) : un simple booléen au lieu de réutiliser
-- get_my_active_hide (qui renvoie thumbnail/compteurs de tentatives, inutiles
-- ici). S'appuie sur l'index partiel unique déjà existant
-- uniq_active_hide_per_creator(creator_id) where status = 'active' :
-- exists() est donc un index-only scan, coût quasi nul même appelé sur
-- chaque page vue.

create or replace function has_active_hide(p_creator_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from hides
    where creator_id = p_creator_id and status = 'active' and expires_at > now()
  );
$$;

grant execute on function has_active_hide(text) to anon, authenticated;
