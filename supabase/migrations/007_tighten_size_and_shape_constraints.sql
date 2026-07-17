-- Défense en profondeur : la contrainte de table doit refléter la même règle
-- métier que la RPC (min 6%, jamais 2%), au cas où une future voie d'insertion
-- oublierait de clamper.
alter table hides drop constraint if exists hides_size_pct_check;
alter table hides add constraint hides_size_pct_check
  check (size_pct >= 6 and size_pct <= 40);

-- Idem pour la forme : seules les formes connues du jeu sont acceptées.
alter table hides drop constraint if exists hides_sticker_id_check;
alter table hides add constraint hides_sticker_id_check
  check (sticker_id in (
    'dot','square','rectangle','triangle','star','heart','diamond','hexagon','plus','ring'
  ));
