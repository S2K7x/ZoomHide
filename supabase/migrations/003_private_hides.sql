-- Cachettes privées : code à 6 chiffres, jamais dans le feed public.

alter table hides add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));
alter table hides add column if not exists code text;

create unique index if not exists idx_hides_active_code
  on hides(code) where status = 'active' and visibility = 'private';

-- Table anti-bruteforce de résolution de code.
create table if not exists code_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_code_attempts_rate on code_attempts(identifier, attempted_at);
alter table code_attempts enable row level security;
revoke all on code_attempts from anon, authenticated;

-- Le feed public exclut désormais les cachettes privées (filtre dans la vue,
-- seul point d'accès en lecture — aucune policy directe sur hides).
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
where h.status = 'active' and h.expires_at > now() and h.visibility = 'public';

grant select on active_hides to anon, authenticated;

-- create_hide : ajoute la visibilité + génère un code unique si privée.
drop function if exists create_hide(text, text, text, text, text, text, float, float, float, float);
create or replace function create_hide(
  p_creator_id text, p_name text,
  p_photo_url text, p_thumbnail_url text, p_sticker_id text, p_color text,
  p_pos_x float, p_pos_y float, p_size_pct float, p_rotation float,
  p_visibility text
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_color text;
  v_visibility text;
  v_code text := null;
  v_try int := 0;
begin
  perform upsert_player(p_creator_id, p_name);
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  v_color := case when p_color ~ '^#[0-9a-fA-F]{6}$' then lower(p_color) else '#f6c944' end;
  v_visibility := case when p_visibility = 'private' then 'private' else 'public' end;

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
                     pos_x, pos_y, size_pct, rotation, visibility, code)
  values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id, v_color,
          p_pos_x, p_pos_y, p_size_pct, coalesce(p_rotation, 0), v_visibility, v_code)
  returning id into v_id;
  return json_build_object('id', v_id, 'visibility', v_visibility, 'code', v_code);
end;
$$;
grant execute on function create_hide(text, text, text, text, text, text, float, float, float, float, text) to anon, authenticated;

-- Résolution d'un code privé, rate-limitée. Ne révèle jamais si le code est
-- invalide vs expiré ; ne renvoie que l'id (le détail passe ensuite par
-- get_hide_detail, comme le flow public, donc jamais de pos_x/pos_y).
create or replace function get_hide_by_code(p_code text, p_identifier text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  if p_identifier is null or length(p_identifier) < 4 then
    return json_build_object('error', 'rate_limited');
  end if;

  select count(*) into v_count from code_attempts
  where identifier = p_identifier and attempted_at > now() - interval '1 hour';
  if v_count >= 10 then
    return json_build_object('error', 'rate_limited');
  end if;

  -- toute tentative compte (même mal formée) pour freiner le bruteforce
  insert into code_attempts (identifier) values (p_identifier);

  if p_code !~ '^[0-9]{6}$' then
    return json_build_object('error', 'not_found');
  end if;

  select id into v_id from hides
  where code = p_code and status = 'active' and visibility = 'private' and expires_at > now();
  if v_id is null then
    return json_build_object('error', 'not_found');
  end if;
  return json_build_object('id', v_id);
end;
$$;
grant execute on function get_hide_by_code(text, text) to anon, authenticated;

-- Nettoyage quotidien des tentatives de code (hygiène free tier).
select cron.schedule('cleanup-code-attempts', '15 3 * * *',
  $$delete from public.code_attempts where attempted_at < now() - interval '2 hours'$$);

-- get_my_active_hide : renvoie aussi la visibilité et le code.
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
    'visibility', v_hide.visibility,
    'code', v_hide.code,
    'created_at', v_hide.created_at,
    'expires_at', v_hide.expires_at,
    'total_attempts', (select count(*) from attempts where hide_id = v_hide.id),
    'finds', (select count(*) from attempts where hide_id = v_hide.id and success)
  );
end;
$$;
