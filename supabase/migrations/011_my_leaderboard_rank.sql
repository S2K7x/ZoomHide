-- 2026-08-10 — Rang du joueur hors du top 50 affiché par get_leaderboard.
-- get_leaderboard (001_init.sql) tronque à `limit 50` : un joueur classé
-- au-delà n'a aujourd'hui aucun moyen de connaître son propre rang/score.
-- Cette RPC recalcule le même classement (mêmes formules de score, même
-- filtre sur la période) sans limite, et ne renvoie que la ligne du joueur
-- demandé — jamais le classement complet des autres joueurs.
-- Coût : même ordre de grandeur qu'un appel à get_leaderboard (agrégation
-- complète sur hides/attempts), sans le `limit 50` ; appelée au plus une
-- fois par affichage de /leaderboard, uniquement si le joueur n'apparaît
-- pas déjà dans les 50 lignes retournées par get_leaderboard.

create or replace function get_my_rank(p_player_id text, p_board text, p_period text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_since timestamptz;
  v_result json;
begin
  v_since := case when p_period = 'week' then date_trunc('week', now()) else '-infinity'::timestamptz end;

  if p_board = 'hiders' then
    with scored as (
      select h.creator_id as player_id,
             count(a.id) filter (where not a.success and a.created_at >= v_since) as fails,
             count(distinct h.id) filter (where h.badge = 'perfect_hide' and h.expires_at >= v_since) as perfects
      from hides h
      left join attempts a on a.hide_id = h.id
      where h.status <> 'deleted'
      group by h.creator_id
    ), ranked as (
      select player_id,
             (fails * 10 + perfects * 500)::int as score,
             fails::int as fails_caused,
             perfects::int as perfect_hides,
             rank() over (order by (fails * 10 + perfects * 500) desc) as rank
      from scored
      where fails > 0 or perfects > 0
    )
    select row_to_json(t) into v_result from (
      select rank, score, fails_caused, perfect_hides from ranked where player_id = p_player_id
    ) t;
  else
    with scored as (
      select a.player_id,
             sum(greatest(100
               - 25 * (select count(*) from attempts b
                       where b.hide_id = a.hide_id and b.player_id = a.player_id
                         and b.created_at < a.created_at)
               - least(a.time_ms / 1000, 50), 10))::int as score,
             count(*)::int as finds
      from attempts a
      where a.success and a.created_at >= v_since
      group by a.player_id
    ), ranked as (
      select player_id, score, finds,
             rank() over (order by score desc) as rank
      from scored
    )
    select row_to_json(t) into v_result from (
      select rank, score, finds from ranked where player_id = p_player_id
    ) t;
  end if;

  return v_result; -- null si le joueur n'a encore aucun score sur ce board/cette période
end;
$$;

grant execute on function get_my_rank(text, text, text) to anon, authenticated;
