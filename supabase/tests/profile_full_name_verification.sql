-- Vérification de profile_full_name (migration 20261102110000), à exécuter
-- sur staging après la migration. Lecture seule.
do $$
declare
  c record;
  got text;
  fails int := 0;
begin
  for c in
    select * from (values
      ('Thomas', 'Levy', 'Thomas Levy'),
      ('Thomas', 'Thomas', 'Thomas'),
      ('Thomas', 'thomas', 'Thomas'),
      ('Thomas', 'Thomas Levy', 'Thomas Levy'),
      ('  Thomas ', ' Levy  ', 'Thomas Levy'),
      ('Thomas', '', 'Thomas'),
      ('Thomas', null, 'Thomas'),
      ('', 'Levy', 'Levy'),
      (null, 'Levy', 'Levy'),
      ('', '', null),
      (null, null, null),
      ('Jean', 'Jeanne', 'Jean Jeanne'),
      ('Marie', 'Marie-Claire Dupont', 'Marie Marie-Claire Dupont')
    ) v(first_name, name, expected)
  loop
    got := public.profile_full_name(c.first_name, c.name);
    if got is distinct from c.expected then
      fails := fails + 1;
      raise warning 'ÉCHEC (%, %) → % (attendu %)', c.first_name, c.name, got, c.expected;
    end if;
  end loop;
  if fails > 0 then raise exception '% cas en échec', fails; end if;
  raise notice 'profile_full_name : tous les cas passent';
end;
$$;
