-- Indices progressifs : le cacheur écrit jusqu'à 3 indices texte (« près de
-- quelque chose de bleu », « moitié haute »…). Le k-ième indice se débloque
-- après le k-ième raté du joueur sur cette cachette (tous jours confondus).
--
-- Les indices vivent dans `hides`, table sous RLS sans policy : ils ne sortent
-- QUE par get_hide_detail / try_attempt, tronqués au nombre de ratés du joueur.
-- La vue `active_hides` ne les expose pas.

alter table hides add column if not exists clues text[] not null default '{}';
alter table hides drop constraint if exists hides_clues_max;
alter table hides add constraint hides_clues_max
  check (coalesce(array_length(clues, 1), 0) <= 3);

-- Nombre de ratés d'un joueur sur une cachette = nombre d'indices débloqués.
create or replace function unlocked_clues(p_hide hides, p_player_id text)
returns text[]
language sql stable security definer set search_path = public
as $$
  select case
    when p_hide.creator_id = p_player_id
      or exists (select 1 from attempts a
                 where a.hide_id = p_hide.id and a.player_id = p_player_id and a.success)
    then p_hide.clues
    else p_hide.clues[1:(select count(*) from attempts a
                         where a.hide_id = p_hide.id and a.player_id = p_player_id
                           and not a.success)::int]
  end;
$$;
-- Helper interne : jamais appelable directement via PostgREST.
revoke execute on function unlocked_clues(hides, text) from public, anon, authenticated;

-- create_hide : nouveau paramètre p_clues (défaut vide → un front pas encore
-- redéployé continue d'appeler la fonction à 11 arguments nommés sans souci).
drop function if exists create_hide(text, text, text, text, text, text, float, float, float, float, text);

create or replace function create_hide(
  p_creator_id text, p_name text,
  p_photo_url text, p_thumbnail_url text, p_sticker_id text, p_color text,
  p_pos_x float, p_pos_y float, p_size_pct float, p_rotation float,
  p_visibility text, p_clues text[] default '{}'
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_color text;
  v_visibility text;
  v_size float;
  v_code text := null;
  v_try int := 0;
  v_clues text[];
begin
  perform upsert_player(p_creator_id, p_name);
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  v_color := case
    when p_color ~ '^#[0-9a-fA-F]{6}' then lower(substring(p_color from 1 for 7))
    else '#f6c944'
  end;
  v_visibility := case when p_visibility = 'private' then 'private' else 'public' end;
  v_size := least(greatest(coalesce(p_size_pct, 8), 6), 40); -- min 6%, max 40%

  -- Indices : trim, vides retirés, 80 caractères max chacun, 3 max.
  select coalesce(array_agg(c order by ord), '{}') into v_clues
  from (
    select left(btrim(c), 80) as c, ord
    from unnest(coalesce(p_clues, '{}')) with ordinality as t(c, ord)
    where btrim(coalesce(c, '')) <> ''
    order by ord
    limit 3
  ) s;

  if v_visibility = 'private' then
    loop
      v_try := v_try + 1;
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      exit when not exists (
        select 1 from hides where code = v_code and status = 'active' and visibility = 'private'
      );
      if v_try > 30 then raise exception 'code_gen_failed'; end if;
    end loop;
  end if;

  insert into hides (creator_id, photo_url, thumbnail_url, sticker_id, sticker_color,
                     pos_x, pos_y, size_pct, rotation, visibility, code, clues)
  values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id, v_color,
          p_pos_x, p_pos_y, v_size, coalesce(p_rotation, 0), v_visibility, v_code, v_clues)
  returning id into v_id;
  return json_build_object('id', v_id, 'visibility', v_visibility, 'code', v_code);
end;
$$;
grant execute on function create_hide(text, text, text, text, text, text, float, float, float, float, text, text[]) to anon, authenticated;

-- get_hide_detail : + `clues` (débloqués) et `clues_total`.
create or replace function get_hide_detail(p_hide_id uuid, p_player_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_hide hides%rowtype;
  v_today int;
  v_found boolean;
  v_reveal json := null;
begin
  select * into v_hide from hides where id = p_hide_id;
  if not found or v_hide.status <> 'active' or v_hide.expires_at <= now() then
    return json_build_object('error', 'not_active');
  end if;

  select count(*) into v_today from attempts
  where hide_id = p_hide_id and player_id = p_player_id and attempt_date = current_date;

  select exists (select 1 from attempts
    where hide_id = p_hide_id and player_id = p_player_id and success) into v_found;

  if v_found or v_hide.creator_id = p_player_id then
    v_reveal := json_build_object('pos_x', v_hide.pos_x, 'pos_y', v_hide.pos_y,
                                  'size_pct', v_hide.size_pct, 'rotation', v_hide.rotation);
  end if;

  return json_build_object(
    'id', v_hide.id,
    'photo_url', v_hide.photo_url,
    'sticker_id', v_hide.sticker_id,
    'sticker_color', v_hide.sticker_color,
    'creator_name', (select coalesce(name, 'Anonymous') from players where id = v_hide.creator_id),
    'is_creator', v_hide.creator_id = p_player_id,
    'expires_at', v_hide.expires_at,
    'attempts_today', v_today,
    'attempts_left', greatest(3 - v_today, 0),
    'already_found', v_found,
    'reveal', v_reveal,
    'clues', to_json(unlocked_clues(v_hide, p_player_id)),
    'clues_total', coalesce(array_length(v_hide.clues, 1), 0)
  );
end;
$$;

-- try_attempt : identique, + `clues` débloqués après cette tentative.
create or replace function try_attempt(
  p_hide_id uuid, p_player_id text, p_name text,
  p_tap_x float, p_tap_y float, p_time_ms int
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_hide hides%rowtype;
  v_today int;
  v_distance float;
  v_tolerance float;
  v_success boolean;
  v_reveal json := null;
begin
  perform upsert_player(p_player_id, p_name);
  select * into v_hide from hides where id = p_hide_id for update;
  if not found or v_hide.status <> 'active' or v_hide.expires_at <= now() then
    return json_build_object('error', 'not_active');
  end if;
  if v_hide.creator_id = p_player_id then
    return json_build_object('error', 'own_hide');
  end if;
  if exists (select 1 from attempts
             where hide_id = p_hide_id and player_id = p_player_id and success) then
    return json_build_object('error', 'already_found');
  end if;

  select count(*) into v_today from attempts
  where hide_id = p_hide_id and player_id = p_player_id and attempt_date = current_date;
  if v_today >= 3 then
    return json_build_object('error', 'limit_reached');
  end if;

  if p_tap_x is null or p_tap_y is null
     or p_tap_x < 0 or p_tap_x > 100 or p_tap_y < 0 or p_tap_y > 100 then
    return json_build_object('error', 'invalid_tap');
  end if;

  v_distance := sqrt(power(p_tap_x - v_hide.pos_x, 2) + power(p_tap_y - v_hide.pos_y, 2));
  -- tolérance : ~60% de la taille du sticker (en % de largeur image), min 2.5%
  v_tolerance := greatest(v_hide.size_pct * 0.6, 2.5);
  v_success := v_distance <= v_tolerance;

  insert into attempts (hide_id, player_id, tap_x, tap_y, success, distance, time_ms)
  values (p_hide_id, p_player_id, p_tap_x, p_tap_y, v_success, v_distance,
          least(greatest(coalesce(p_time_ms, 0), 0), 3600000));

  -- reveal si trouvé, ou si c'était la 3e tentative du jour
  if v_success or v_today + 1 >= 3 then
    v_reveal := json_build_object('pos_x', v_hide.pos_x, 'pos_y', v_hide.pos_y,
                                  'size_pct', v_hide.size_pct, 'rotation', v_hide.rotation);
  end if;

  return json_build_object(
    'success', v_success,
    'distance', round(v_distance::numeric, 1),
    'attempts_left', greatest(3 - (v_today + 1), 0),
    'reveal', v_reveal,
    'clues', to_json(unlocked_clues(v_hide, p_player_id)),
    'clues_total', coalesce(array_length(v_hide.clues, 1), 0)
  );
end;
$$;
