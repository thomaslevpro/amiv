drop policy if exists "group_cards_insert" on public.group_cards;
drop policy if exists "group_cards_upsert_update" on public.group_cards;

create policy "group_cards_insert" on public.group_cards
for insert with check (
  auth.role() = 'authenticated'
  and status = 'collecting'
  and revealed_at is null
  and revealed_by is null
  and exists (
    select 1 from public.events e
    where e.id = group_cards.event_id
  )
);

create policy "group_cards_upsert_update" on public.group_cards
for update using (
  exists (
    select 1 from public.events e
    where e.id = group_cards.event_id
      and (
        e.user_id = auth.uid()
        or (
          e.birthday_person_user_id = auth.uid()
          and e.date is not null
          and now() >= e.date
        )
      )
  )
  or exists (
    select 1 from public.rsvps r
    where r.event_id = group_cards.event_id
      and r.user_id = auth.uid()
      and r.status in ('going')
  )
  or exists (
    select 1 from public.invitations i
    where i.event_id = group_cards.event_id
      and (i.invited_user_id = auth.uid() or i.invited_email = auth.email())
      and i.status in ('accepted', 'going')
  )
) with check (
  exists (
    select 1 from public.events e
    where e.id = group_cards.event_id
      and (
        e.user_id = auth.uid()
        or (
          e.birthday_person_user_id = auth.uid()
          and e.date is not null
          and now() >= e.date
        )
      )
  )
  or exists (
    select 1 from public.rsvps r
    where r.event_id = group_cards.event_id
      and r.user_id = auth.uid()
      and r.status in ('going')
  )
  or exists (
    select 1 from public.invitations i
    where i.event_id = group_cards.event_id
      and (i.invited_user_id = auth.uid() or i.invited_email = auth.email())
      and i.status in ('accepted', 'going')
  )
);

drop policy if exists "gcm_insert_confirmed_only" on public.group_card_messages;

create policy "gcm_insert_confirmed_only" on public.group_card_messages
for insert with check (
  auth.uid() = user_id
  and (
    exists (
      select 1 from public.rsvps r
      where r.event_id = group_card_messages.event_id
        and r.user_id = auth.uid()
        and r.status in ('going')
    )
    or exists (
      select 1 from public.invitations i
      where i.event_id = group_card_messages.event_id
        and (i.invited_user_id = auth.uid() or i.invited_email = auth.email())
        and i.status in ('accepted', 'going')
    )
    or exists (
      select 1 from public.events e
      where e.id = group_card_messages.event_id
        and e.user_id = auth.uid()
    )
  )
);
