-- Le sticker doit toujours rester pleinement visible : on n'accepte plus de
-- couleur avec alpha (8 chiffres hex). Même si un client bidouillé envoie
-- #rrggbbaa, seuls les 6 premiers chiffres sont gardés (alpha forcé à opaque).
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
  v_size float;
  v_code text := null;
  v_try int := 0;
begin
  perform upsert_player(p_creator_id, p_name);
  perform pg_advisory_xact_lock(hashtext(p_creator_id));
  if exists (select 1 from hides where creator_id = p_creator_id and status = 'active') then
    return json_build_object('error', 'already_active');
  end if;
  -- Toujours opaque : on ne garde que les 6 premiers chiffres hex quel que
  -- soit ce qu'envoie le client (un éventuel suffixe alpha est ignoré).
  v_color := case
    when p_color ~ '^#[0-9a-fA-F]{6}' then lower(substring(p_color from 1 for 7))
    else '#f6c944'
  end;
  v_visibility := case when p_visibility = 'private' then 'private' else 'public' end;
  v_size := least(greatest(coalesce(p_size_pct, 8), 6), 40); -- min 6%, max 40%

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
          p_pos_x, p_pos_y, v_size, coalesce(p_rotation, 0), v_visibility, v_code)
  returning id into v_id;
  return json_build_object('id', v_id, 'visibility', v_visibility, 'code', v_code);
end;
$$;
grant execute on function create_hide(text, text, text, text, text, text, float, float, float, float, text) to anon, authenticated;

-- La contrainte reflète la même règle au niveau du schéma : jamais d'alpha,
-- une éventuelle mise à jour future (ex: script admin) ne peut pas la
-- contourner non plus.
alter table hides drop constraint if exists hides_sticker_color_opaque;
alter table hides add constraint hides_sticker_color_opaque
  check (sticker_color ~ '^#[0-9a-fA-F]{6}$');
