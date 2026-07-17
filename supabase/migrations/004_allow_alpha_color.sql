-- Autorise une couleur avec alpha (#rrggbbaa) pour l'opacité du sticker.
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
  v_color := case when p_color ~ '^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$' then lower(p_color) else '#f6c944' end;
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
