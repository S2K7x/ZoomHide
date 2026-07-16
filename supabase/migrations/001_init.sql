-- ZoomHide — schéma initial
-- Sécurité : aucune table n'est lisible/écrivable directement par le client.
-- Lecture publique via la vue active_hides (sans pos_x/pos_y), écritures via RPC security definer.

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table players (
  id text primary key,
  name text not null default 'Anonyme',
  created_at timestamptz not null default now()
);

create table hides (
  id uuid primary key default gen_random_uuid(),
  creator_id text not null references players(id),
  photo_url text not null,
  thumbnail_url text not null,
  sticker_id text not null,
  pos_x float not null check (pos_x between 0 and 100),
  pos_y float not null check (pos_y between 0 and 100),
  size_pct float not null check (size_pct between 2 and 40),
  rotation float not null default 0,
  status text not null default 'active' check (status in ('active','expired','deleted')),
  badge text check (badge in ('perfect_hide','easy','hard','legendary')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

-- 1 cachette active max par joueur, garanti au niveau DB
create unique index uniq_active_hide_per_creator on hides(creator_id) where status = 'active';
create index idx_hides_status on hides(status);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  hide_id uuid not null references hides(id) on delete cascade,
  player_id text not null references players(id),
  attempt_date date not null default current_date,
  tap_x float not null,
  tap_y float not null,
  success boolean not null,
  distance float not null,
  time_ms int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_attempts_daily on attempts(hide_id, player_id, attempt_date);
create index idx_attempts_player on attempts(player_id, created_at);

create table reports (
  id uuid primary key default gen_random_uuid(),
  hide_id uuid not null references hides(id) on delete cascade,
  reporter_id text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS : tout est verrouillé, aucune policy pour anon => aucun accès direct
-- ---------------------------------------------------------------------------

alter table players enable row level security;
alter table hides enable row level security;
alter table attempts enable row level security;
alter table reports enable row level security;

revoke all on players, hides, attempts, reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vue publique du feed : n'expose JAMAIS pos_x / pos_y / size_pct / rotation
-- ---------------------------------------------------------------------------

create view active_hides as
select
  h.id,
  h.creator_id,
  coalesce(p.name, 'Anonyme') as creator_name,
  h.photo_url,
  h.thumbnail_url,
  h.sticker_id,
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

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create or replace function upsert_player(p_player_id text, p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_player_id is null or length(p_player_id) < 8 or length(p_player_id) > 64 then
    raise exception 'invalid_player';
  end if;
  insert into players (id, name)
  values (p_player_id, left(coalesce(nullif(trim(p_name), ''), 'Anonyme'), 24))
  on conflict (id) do update set name = excluded.name;
end;
$$;

create or replace function create_hide(
  p_creator_id text, p_name text,
  p_photo_url text, p_thumbnail_url text, p_sticker_id text,
  p_pos_x float, p_pos_y float, p_size_pct float, p_rotation float
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  perform upsert_player(p_creator_id, p_name);
  -- verrou par joueur pour éviter la course sur la règle "1 active max"
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  insert into hides (creator_id, photo_url, thumbnail_url, sticker_id, pos_x, pos_y, size_pct, rotation)
  values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id,
          p_pos_x, p_pos_y, p_size_pct, coalesce(p_rotation, 0))
  returning id into v_id;
  return json_build_object('id', v_id);
end;
$$;

create or replace function delete_hide(p_hide_id uuid, p_creator_id text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  update hides set status = 'deleted'
  where id = p_hide_id and creator_id = p_creator_id and status = 'active';
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  return json_build_object('ok', true);
end;
$$;

create or replace function report_hide(p_hide_id uuid, p_reporter_id text, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into reports (hide_id, reporter_id, reason)
  values (p_hide_id, p_reporter_id, left(coalesce(p_reason, ''), 500));
end;
$$;

-- Détail d'une cachette pour la page de jeu. Ne révèle la position que si le
-- joueur l'a déjà trouvée ou en est le créateur.
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
    'creator_name', (select coalesce(name, 'Anonyme') from players where id = v_hide.creator_id),
    'is_creator', v_hide.creator_id = p_player_id,
    'expires_at', v_hide.expires_at,
    'attempts_today', v_today,
    'attempts_left', greatest(3 - v_today, 0),
    'already_found', v_found,
    'reveal', v_reveal
  );
end;
$$;

-- Cœur du jeu : calcul du succès 100% côté serveur.
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
    'reveal', v_reveal
  );
end;
$$;

-- Cachette active du joueur (avec position : c'est la sienne) + stats
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
    'created_at', v_hide.created_at,
    'expires_at', v_hide.expires_at,
    'total_attempts', (select count(*) from attempts where hide_id = v_hide.id),
    'finds', (select count(*) from attempts where hide_id = v_hide.id and success)
  );
end;
$$;

-- Leaderboards. p_board: 'hiders' | 'seekers', p_period: 'week' | 'all'
create or replace function get_leaderboard(p_board text, p_period text)
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
      select p.name, x.player_id,
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
      select p.name, a.player_id,
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

-- Droits d'exécution : uniquement les RPC prévues
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function upsert_player(text, text) to anon, authenticated;
grant execute on function create_hide(text, text, text, text, text, float, float, float, float) to anon, authenticated;
grant execute on function delete_hide(uuid, text) to anon, authenticated;
grant execute on function report_hide(uuid, text, text) to anon, authenticated;
grant execute on function get_hide_detail(uuid, text) to anon, authenticated;
grant execute on function try_attempt(uuid, text, text, float, float, int) to anon, authenticated;
grant execute on function get_my_active_hide(text) to anon, authenticated;
grant execute on function get_leaderboard(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage : bucket public "photos", upload anon limité aux images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1572864, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "public read photos" on storage.objects
  for select using (bucket_id = 'photos');
create policy "anon upload photos" on storage.objects
  for insert with check (bucket_id = 'photos');

-- ---------------------------------------------------------------------------
-- Cron : expiration + badges (toutes les heures), nettoyage storage (quotidien)
-- ---------------------------------------------------------------------------

create or replace function expire_hides()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update hides h set
    status = 'expired',
    badge = case
      when not exists (select 1 from attempts a where a.hide_id = h.id and a.success)
        then 'perfect_hide'
      when (select count(*) filter (where not a.success) * 100.0 / count(*)
            from attempts a where a.hide_id = h.id) >= 60 then 'legendary'
      when (select count(*) filter (where not a.success) * 100.0 / count(*)
            from attempts a where a.hide_id = h.id) >= 30 then 'hard'
      else 'easy'
    end
  where h.status = 'active' and h.expires_at <= now();
end;
$$;

-- Supprime les métadonnées storage des photos de cachettes expirées/supprimées
-- depuis plus de 30 jours (les URLs deviennent inaccessibles).
create or replace function cleanup_old_photos()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from storage.objects o
  where o.bucket_id = 'photos'
    and exists (
      select 1 from hides h
      where h.status in ('expired', 'deleted')
        and h.expires_at < now() - interval '30 days'
        and (h.photo_url like '%' || o.name or h.thumbnail_url like '%' || o.name)
    );
end;
$$;

select cron.schedule('expire-hides', '0 * * * *', $$select public.expire_hides()$$);
select cron.schedule('cleanup-photos', '30 3 * * *', $$select public.cleanup_old_photos()$$);
