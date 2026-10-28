-- prepare_account_deletion échouait (55000 : cannot delete from view
-- "calendar_feed_items") : calendar_feed_items est une vue (UNION ALL sur
-- calendar_tokens × events / birthdays), non modifiable. Le flux agenda est
-- dérivé des tables sources, et calendar_tokens est supprimé en cascade avec
-- l'utilisateur (auth.users → profiles → calendar_tokens, ON DELETE CASCADE).
-- Le transfert ne se fait qu'à un co-organisateur approuvé (même règle que
-- is_event_organizer) : un co-organisateur en attente ou refusé ne doit pas
-- devenir propriétaire.
-- Fonction identique à 20261027120000_account_deletion, à ces deux différences près.

create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event record;
  v_new_owner uuid;
  v_transferred uuid[] := array[]::uuid[];
  v_deleted uuid[] := array[]::uuid[];
  v_files jsonb;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  for v_event in
    select e.id, e.name, e.date, e.birthday_person_user_id
    from public.events e
    where e.user_id = p_user_id
    for update
  loop
    select o.user_id
      into v_new_owner
    from public.event_organizers o
    where o.event_id = v_event.id
      and o.role = 'co_organizer'
      and o.status = 'approved'
      and o.user_id <> p_user_id
    order by o.created_at
    limit 1;

    if v_new_owner is not null then
      update public.events set user_id = v_new_owner where id = v_event.id;
      update public.event_organizers
        set role = 'owner'
        where event_id = v_event.id and user_id = v_new_owner;
      delete from public.event_organizers
        where event_id = v_event.id and user_id = p_user_id;
      v_transferred := v_transferred || v_event.id;
    else
      -- Événement à venir (aujourd'hui inclus, ou date encore en sondage) :
      -- prévenir les invités. ::date fonctionne que la colonne soit date ou
      -- timestamptz. La personne fêtée est exclue pour ne pas révéler une surprise.
      if v_event.date is null or v_event.date::date >= current_date then
        insert into public.notifications (user_id, type, title, body, data)
        select recipient_id,
               'event_updated',
               coalesce(nullif(trim(v_event.name), ''), 'Un événement') || ' est annulé',
               'L''organisateur a supprimé son compte Amiv.',
               jsonb_build_object('cancelled', true, 'event_name', v_event.name)
        from (
          select r.user_id as recipient_id from public.rsvps r where r.event_id = v_event.id
          union
          select i.invited_user_id from public.invitations i where i.event_id = v_event.id
          union
          select o.user_id from public.event_organizers o where o.event_id = v_event.id
        ) recipients
        where recipient_id is not null
          and recipient_id <> p_user_id
          and recipient_id is distinct from v_event.birthday_person_user_id;
      end if;

      delete from public.events where id = v_event.id;
      v_deleted := v_deleted || v_event.id;
    end if;
  end loop;

  -- Colonnes sans clé étrangère
  update public.events set cagnotte_created_by = null where cagnotte_created_by = p_user_id;
  delete from public.group_card_reactions where user_id = p_user_id;

  -- Mots de carte d'anniversaire et souvenirs : supprimés (décision produit)
  delete from public.group_card_messages where user_id = p_user_id;
  delete from public.collective_memories where contributor_id = p_user_id;

  -- Fichiers Storage : ceux de l'utilisateur + ceux des événements supprimés.
  -- Les couvertures d'événements transférés sont conservées.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', o.bucket_id, 'name', o.name)), '[]'::jsonb)
    into v_files
  from storage.objects o
  where (
      o.bucket_id in ('avatars', 'card-photos', 'memory-images')
      and o.owner_id = p_user_id::text
    )
    or (o.bucket_id = 'avatars' and o.name like p_user_id::text || '.%')
    or (o.bucket_id = 'memory-images' and split_part(o.name, '/', 2) = p_user_id::text)
    or (o.bucket_id = 'card-photos' and split_part(o.name, '/', 2) like p_user_id::text || '\_%')
    or (
      o.bucket_id in ('event-covers', 'card-photos', 'memory-images')
      and split_part(o.name, '/', 1) = any (v_deleted::text[])
    )
    -- Rejeu après un échec : couvertures déjà orphelines de ses événements supprimés
    or (
      o.bucket_id = 'event-covers'
      and o.owner_id = p_user_id::text
      and not exists (select 1 from public.events e where e.id::text = split_part(o.name, '/', 1))
    );

  return jsonb_build_object(
    'transferred_event_ids', to_jsonb(v_transferred),
    'deleted_event_ids', to_jsonb(v_deleted),
    'files', v_files
  );
end;
$$;

revoke all on function public.prepare_account_deletion(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid) to service_role;
