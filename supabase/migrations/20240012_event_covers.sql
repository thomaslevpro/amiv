alter table public.events
  add column if not exists cover_image text;

insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do update set public = true;

drop policy if exists "event_covers_public_read" on storage.objects;
drop policy if exists "event_covers_organizer_insert" on storage.objects;
drop policy if exists "event_covers_organizer_update" on storage.objects;
drop policy if exists "event_covers_organizer_delete" on storage.objects;

create policy "event_covers_public_read" on storage.objects
for select using (bucket_id = 'event-covers');

create policy "event_covers_organizer_insert" on storage.objects
for insert with check (
  bucket_id = 'event-covers'
  and exists (
    select 1
    from public.events e
    where e.id::text = split_part(storage.objects.name, '/', 1)
      and e.user_id = auth.uid()
  )
);

create policy "event_covers_organizer_update" on storage.objects
for update using (
  bucket_id = 'event-covers'
  and exists (
    select 1
    from public.events e
    where e.id::text = split_part(storage.objects.name, '/', 1)
      and e.user_id = auth.uid()
  )
) with check (
  bucket_id = 'event-covers'
  and exists (
    select 1
    from public.events e
    where e.id::text = split_part(storage.objects.name, '/', 1)
      and e.user_id = auth.uid()
  )
);

create policy "event_covers_organizer_delete" on storage.objects
for delete using (
  bucket_id = 'event-covers'
  and exists (
    select 1
    from public.events e
    where e.id::text = split_part(storage.objects.name, '/', 1)
      and e.user_id = auth.uid()
  )
);
