-- 2026-07-18 — Statut par lot (tenté/trouvé) pour le feed public.
-- Permet d'afficher un badge « déjà tenté » / « déjà trouvé » sur les cartes
-- du feed sans exposer la position ni faire une requête par carte : un seul
-- appel RPC groupé sur les ids déjà chargés par le feed (max 60, cf. limit()
-- côté /play). Read-only, aucune donnée sensible (pos_x/pos_y) renvoyée.

create or replace function get_hide_statuses(p_hide_ids uuid[], p_player_id text)
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_object_agg(x.id, x.status), '{}'::json)
  from (
    select ids.id,
      case when bool_or(a.success) then 'found' else 'attempted' end as status
    from unnest(p_hide_ids[1:200]) as ids(id)
    join attempts a on a.hide_id = ids.id and a.player_id = p_player_id
    group by ids.id
  ) x;
$$;

grant execute on function get_hide_statuses(uuid[], text) to anon, authenticated;
