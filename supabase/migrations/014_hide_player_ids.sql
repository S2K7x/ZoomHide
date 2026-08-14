-- ---------------------------------------------------------------------------
-- Sécurité : les identifiants de joueur ne sont plus exposés publiquement.
--
-- L'identité d'un joueur est un `crypto.randomUUID()` stocké en localStorage
-- (`lib/player.ts`) : c'est le seul secret du jeu, et plusieurs RPC accordent
-- des droits sur sa seule présentation (`delete_hide(p_hide_id, p_creator_id)`
-- notamment). Or deux surfaces publiques le livraient en clair :
--
--   1. la vue `active_hides` (lisible par `anon` via PostgREST) renvoyait
--      `creator_id` à côté de `id` — soit exactement le couple attendu par
--      `delete_hide`. Un `GET /rest/v1/active_hides?select=id,creator_id`
--      suivi d'un `POST /rest/v1/rpc/delete_hide` supprimait n'importe quelle
--      cachette publique du feed, sans authentification ;
--   2. `get_leaderboard` renvoyait le `player_id` des 50 meilleurs joueurs
--      (le client s'en servait pour surligner la ligne « you »). Sur le
--      classement des cacheurs, ces `player_id` sont des `creator_id` : même
--      si on retire (1), il resterait à croiser ces 50 ids avec les hide_id
--      du feed pour retrouver le couple.
--
-- On retire donc l'identifiant des deux sorties. Le surlignage « you » du
-- classement est remplacé par un booléen `is_me` calculé côté serveur.
-- ---------------------------------------------------------------------------

-- 1. Vue du feed public sans `creator_id`
--    (`create or replace view` ne sait pas supprimer une colonne : drop/create)
drop view if exists active_hides;

create view active_hides as
select
  h.id,
  coalesce(p.name, 'Anonymous') as creator_name,
  h.photo_url,
  h.thumbnail_url,
  h.sticker_id,
  h.sticker_color,
  h.created_at,
  h.expires_at,
  coalesce(s.total, 0)::int as total_attempts,
  coalesce(s.finds, 0)::int as finds,
  case when coalesce(s.total, 0) = 0 then null
       else round(100.0 * (s.total - s.finds) / s.total)::int end as fail_pct
from hides h
left join players p on p.id = h.creator_id
left join lateral (
  select count(*) as total, count(*) filter (where a.success) as finds
  from attempts a where a.hide_id = h.id
) s on true
where h.status = 'active' and h.expires_at > now() and h.visibility = 'public';

-- La vue reste en security definer (défaut, `security_invoker` non activé) :
-- c'est elle qui donne l'accès en lecture à `hides`, table sous RLS sans
-- policy. Comportement inchangé, seule la colonne `creator_id` disparaît.
grant select on active_hides to anon, authenticated;

-- 2. Classement sans `player_id` : booléen `is_me` calculé côté serveur.
--    L'ancienne signature (text, text) est supprimée pour qu'aucun appel ne
--    puisse continuer à récupérer les identifiants ; le nouveau paramètre a
--    une valeur par défaut, donc un appel à deux arguments (front pas encore
--    redéployé) reste valide et renvoie simplement `is_me` à false partout.
drop function if exists get_leaderboard(text, text);

create or replace function get_leaderboard(
  p_board text,
  p_period text,
  p_player_id text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_since timestamptz;
  v_result json;
begin
  v_since := case when p_period = 'week' then date_trunc('week', now()) else '-infinity'::timestamptz end;

  if p_board = 'hiders' then
    -- score cacheur : 10 pts par tentative ratée provoquée + 500 par Cachette Parfaite
    select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_result from (
      select p.name,
             (p_player_id is not null and x.player_id = p_player_id) as is_me,
             (x.fails * 10 + x.perfects * 500)::int as score,
             x.fails::int as fails_caused, x.perfects::int as perfect_hides
      from (
        select h.creator_id as player_id,
               count(a.id) filter (where not a.success and a.created_at >= v_since) as fails,
               count(distinct h.id) filter (where h.badge = 'perfect_hide' and h.expires_at >= v_since) as perfects
        from hides h
        left join attempts a on a.hide_id = h.id
        where h.status <> 'deleted'
        group by h.creator_id
      ) x
      join players p on p.id = x.player_id
      where x.fails > 0 or x.perfects > 0
      order by (x.fails * 10 + x.perfects * 500) desc
      limit 50
    ) t;
  else
    -- score chercheur : 100 - 25/raté préalable - 1pt/s (cap 50), min 10, par trouvaille
    select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_result from (
      select p.name,
             (p_player_id is not null and a.player_id = p_player_id) as is_me,
             sum(greatest(100
               - 25 * (select count(*) from attempts b
                       where b.hide_id = a.hide_id and b.player_id = a.player_id
                         and b.created_at < a.created_at)
               - least(a.time_ms / 1000, 50), 10))::int as score,
             count(*)::int as finds
      from attempts a
      join players p on p.id = a.player_id
      where a.success and a.created_at >= v_since
      group by a.player_id, p.name
      order by 3 desc
      limit 50
    ) t;
  end if;

  return v_result;
end;
$$;

-- `drop function` a emporté les droits : on les repose explicitement, comme
-- pour les 10 autres RPC appelées par le client.
revoke execute on function get_leaderboard(text, text, text) from public;
grant execute on function get_leaderboard(text, text, text) to anon, authenticated;
