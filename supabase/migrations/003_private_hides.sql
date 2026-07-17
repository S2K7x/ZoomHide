-- ZoomHide — cachettes privées par code à 6 chiffres (style Kahoot).
--
-- Une cachette privée n'apparaît jamais dans le feed public /play : elle est
-- filtrée directement dans la vue active_hides (le seul point de lecture
-- accordé à anon/authenticated ; la table hides elle-même reste 100%
-- verrouillée par le `revoke all` du schéma initial — donc pas de policy RLS
-- à écrire ici, il suffit d'exclure visibility='private' de la vue).
--
-- Anti-bruteforce : 1M de codes possibles, donc rate-limité côté RPC. Ce
-- projet n'a volontairement aucune Vercel Function (voir README), donc pas
-- d'IP disponible via un edge middleware. On récupère l'IP réelle du visiteur
-- directement dans Postgres via le header transmis par PostgREST
-- (`request.headers`), ce qui reste 100% gratuit et ne peut pas être
-- contourné en changeant un paramètre côté client (contrairement à un
-- identifiant fourni par le client, trivialement rotable à chaque appel).

-- ---------------------------------------------------------------------------
-- Schéma
-- ---------------------------------------------------------------------------

alter table hides add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));
alter table hides add column if not exists code text
  check (code is null or code ~ '^[0-9]{6}$');

-- Un code n'a besoin d'être unique que parmi les cachettes privées ACTIVES :
-- une collision avec une cachette expirée/supprimée est sans conséquence.
create unique index if not exists idx_hides_active_code
  on hides(code) where status = 'active' and visibility = 'private';

-- Journal des résolutions de code, pour le rate limit anti-bruteforce.
create table if not exists code_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists idx_code_attempts_rate on code_attempts(ip_hash, attempted_at);

alter table code_attempts enable row level security;
revoke all on code_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vue publique : n'expose jamais les cachettes privées ni leur code/visibility
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Récupère l'IP réelle du visiteur depuis le header transmis par PostgREST.
-- x-forwarded-for peut contenir plusieurs IPs (proxys) ; on prend la première.
-- Best-effort : sans edge trustée devant Postgres, un client pourrait en
-- théorie tenter d'usurper ce header, mais Supabase (Kong) écrase/complète
-- x-forwarded-for avec l'IP réelle de connexion, donc en pratique c'est fiable
-- pour du rate limiting (pas pour de l'auth).
-- ---------------------------------------------------------------------------

create or replace function request_ip_hash()
returns text
language sql stable
as $$
  select md5(coalesce(
    nullif(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), ''),
    'unknown'
  ));
$$;

-- ---------------------------------------------------------------------------
-- create_hide : ajoute la visibilité + génère le code côté serveur si privée.
-- ---------------------------------------------------------------------------

drop function if exists create_hide(text, text, text, text, text, text, float, float, float, float);
create or replace function create_hide(
  p_creator_id text, p_name text,
  p_photo_url text, p_thumbnail_url text, p_sticker_id text, p_color text,
  p_pos_x float, p_pos_y float, p_size_pct float, p_rotation float,
  p_visibility text default 'public'
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_color text;
  v_visibility text;
  v_code text;
  v_attempts_left int := 20;
begin
  perform upsert_player(p_creator_id, p_name);
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  v_color := case when p_color ~ '^#[0-9a-fA-F]{6}$' then lower(p_color) else '#f6c944' end;
  v_visibility := case when p_visibility = 'private' then 'private' else 'public' end;

  if v_visibility = 'public' then
    insert into hides (creator_id, photo_url, thumbnail_url, sticker_id, sticker_color,
                        pos_x, pos_y, size_pct, rotation, visibility, code)
    values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id, v_color,
            p_pos_x, p_pos_y, p_size_pct, coalesce(p_rotation, 0), 'public', null)
    returning id into v_id;
    return json_build_object('id', v_id);
  end if;

  -- privée : boucle de génération de code avec retry sur collision (rarissime
  -- vu 1M de combinaisons possibles contre le nombre de cachettes actives).
  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    begin
      insert into hides (creator_id, photo_url, thumbnail_url, sticker_id, sticker_color,
                          pos_x, pos_y, size_pct, rotation, visibility, code)
      values (p_creator_id, p_photo_url, p_thumbnail_url, p_sticker_id, v_color,
              p_pos_x, p_pos_y, p_size_pct, coalesce(p_rotation, 0), 'private', v_code)
      returning id into v_id;
      exit;
    exception when unique_violation then
      v_attempts_left := v_attempts_left - 1;
      if v_attempts_left <= 0 then
        raise exception 'could_not_allocate_code';
      end if;
    end;
  end loop;

  return json_build_object('id', v_id, 'code', v_code);
end;
$$;
grant execute on function create_hide(text, text, text, text, text, text, float, float, float, float, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_hide_detail : renvoie aussi visibility/code au créateur uniquement
-- (pour qu'il puisse retrouver le code de sa propre cachette privée).
-- ---------------------------------------------------------------------------

create or replace function get_hide_detail(p_hide_id uuid, p_player_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_hide hides%rowtype;
  v_today int;
  v_found boolean;
  v_reveal json := null;
  v_is_creator boolean;
begin
  select * into v_hide from hides where id = p_hide_id;
  if not found or v_hide.status <> 'active' or v_hide.expires_at <= now() then
    return json_build_object('error', 'not_active');
  end if;

  v_is_creator := v_hide.creator_id = p_player_id;

  select count(*) into v_today from attempts
  where hide_id = p_hide_id and player_id = p_player_id and attempt_date = current_date;

  select exists (select 1 from attempts
    where hide_id = p_hide_id and player_id = p_player_id and success) into v_found;

  if v_found or v_is_creator then
    v_reveal := json_build_object('pos_x', v_hide.pos_x, 'pos_y', v_hide.pos_y,
                                  'size_pct', v_hide.size_pct, 'rotation', v_hide.rotation);
  end if;

  return json_build_object(
    'id', v_hide.id,
    'photo_url', v_hide.photo_url,
    'sticker_id', v_hide.sticker_id,
    'sticker_color', v_hide.sticker_color,
    'creator_name', (select coalesce(name, 'Anonymous') from players where id = v_hide.creator_id),
    'is_creator', v_is_creator,
    'expires_at', v_hide.expires_at,
    'attempts_today', v_today,
    'attempts_left', greatest(3 - v_today, 0),
    'already_found', v_found,
    'reveal', v_reveal,
    'visibility', case when v_is_creator then v_hide.visibility else null end,
    'code', case when v_is_creator then v_hide.code else null end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_hide_by_code : résolution d'un code privé, rate-limitée par IP.
-- Ne distingue jamais "code mal formé" de "code inexistant/expiré" côté
-- réponse : les deux renvoient error='not_found'.
-- ---------------------------------------------------------------------------

create or replace function get_hide_by_code(p_code text, p_player_id text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_ip text;
  v_recent int;
  v_hide hides%rowtype;
begin
  v_ip := request_ip_hash();

  select count(*) into v_recent from code_attempts
  where ip_hash = v_ip and attempted_at > now() - interval '1 hour';
  if v_recent >= 10 then
    return json_build_object('error', 'rate_limited');
  end if;

  insert into code_attempts (ip_hash) values (v_ip);

  if p_code is null or p_code !~ '^[0-9]{6}$' then
    return json_build_object('error', 'not_found');
  end if;

  select * into v_hide from hides
  where code = p_code and status = 'active' and visibility = 'private' and expires_at > now();
  if not found then
    return json_build_object('error', 'not_found');
  end if;

  return get_hide_detail(v_hide.id, p_player_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_active_hide : renvoie aussi visibility/code (le créateur doit
-- pouvoir retrouver le lien à partager même en revenant plus tard sur /create).
-- ---------------------------------------------------------------------------

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
    'visibility', v_hide.visibility,
    'code', v_hide.code,
    'total_attempts', (select count(*) from attempts where hide_id = v_hide.id),
    'finds', (select count(*) from attempts where hide_id = v_hide.id and success)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on function get_hide_by_code(text, text) from public;
grant execute on function get_hide_by_code(text, text) to anon, authenticated;
revoke execute on function request_ip_hash() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Purge du journal de rate limit : ajoutée au job cron horaire existant pour
-- ne pas multiplier les jobs pg_cron (toujours gratuit, une seule ligne de plus).
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

  delete from code_attempts where attempted_at < now() - interval '2 hours';
end;
$$;
