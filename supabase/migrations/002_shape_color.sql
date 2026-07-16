-- ZoomHide — les stickers deviennent des formes simples recolorables.
-- On stocke une couleur hex par cachette. La forme (sticker_id) + la couleur
-- sont des indices publics (le secret reste la POSITION, jamais exposée avant
-- tentative).

alter table hides add column if not exists sticker_color text not null default '#f6c944';

-- Vue publique : expose la couleur (indice), toujours pas la position.
create or replace view active_hides as
select
  h.id,
  h.creator_id,
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
where h.status = 'active' and h.expires_at > now();

grant select on active_hides to anon, authenticated;

-- create_hide : nouvelle signature avec la couleur.
drop function if exists create_hide(text, text, text, text, text, float, float, float, float);
create or replace function create_hide(
  p_creator_id text, p_name text,
  p_photo_url text, p_thumbnail_url text, p_sticker_id text, p_color text,
  p_pos_x float, p_pos_y float, p_size_pct float, p_rotation float
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_color text;
begin
  perform upsert_player(p_creator_id, p_name);
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  v_color := case when p_color ~ '^#[0-9a-fA-F]{6}$' then lower(p_color) else '#f6c944' end;
  insert into hides (creator_id, photo_url, thumbnail_url, sticker_id, sticker_color, pos_x, pos_y, size_pct, rotation)
  values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id, v_color,
          p_pos_x, p_pos_y, p_size_pct, coalesce(p_rotation, 0))
  returning id into v_id;
  return json_build_object('id', v_id);
end;
$$;
grant execute on function create_hide(text, text, text, text, text, text, float, float, float, float) to anon, authenticated;

-- get_hide_detail : renvoie la couleur (indice).
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
    'reveal', v_reveal
  );
end;
$$;

-- get_my_active_hide : renvoie la couleur.
create or replace function get_my_active_hide(p_creator_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_hide hides%rowtype;
begin
  select * into v_hide from hides
  where creator_id = p_creator_id and status = 'active' and expires_at > now();
  if not found then
    return null;
  end if;
  return json_build_object(
    'id', v_hide.id,
    'thumbnail_url', v_hide.thumbnail_url,
    'sticker_id', v_hide.sticker_id,
    'sticker_color', v_hide.sticker_color,
    'created_at', v_hide.created_at,
    'expires_at', v_hide.expires_at,
    'total_attempts', (select count(*) from attempts where hide_id = v_hide.id),
    'finds', (select count(*) from attempts where hide_id = v_hide.id and success)
  );
end;
$$;
