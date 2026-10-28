-- Signalements (App Store 1.2) : messages de chat d'événement (général ou
-- secret), messages privés et profils. Le client ne peut qu'insérer son
-- propre signalement (cible, motif, commentaire) ; aucune lecture côté
-- client. Le trigger vérifie que l'auteur a bien accès à la cible et fige
-- la personne signalée et le contenu au moment du signalement (un message
-- peut être modifié ou supprimé ensuite). L'email à l'admin est envoyé par
-- send-email (action report_created), qui renseigne email_sent_at.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('event_message', 'direct_message', 'profile')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  comment text check (comment is null or char_length(comment) <= 1000),
  reported_user_id uuid references auth.users(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  content_snapshot text,
  created_at timestamptz not null default now(),
  email_sent_at timestamptz,
  unique (reporter_id, target_type, target_id)
);

create index if not exists reports_pending_email_idx on public.reports (reporter_id, created_at) where email_sent_at is null;

alter table public.reports enable row level security;

revoke all on public.reports from anon, authenticated;
grant insert (target_type, target_id, reason, comment) on public.reports to authenticated;

drop policy if exists "Signalements : création par l'auteur" on public.reports;
create policy "Signalements : création par l'auteur"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_message record;
begin
  if v_uid is null or new.reporter_id is distinct from v_uid then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if (select count(*) from public.reports r
      where r.reporter_id = v_uid and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Trop de signalements, réessaie plus tard.' using errcode = '54000';
  end if;

  new.comment := nullif(trim(new.comment), '');

  if new.target_type = 'event_message' then
    select m.user_id, m.event_id, m.content, m.is_secret into v_message
    from public.messages m where m.id = new.target_id;
    if not found or not (
      (not v_message.is_secret and (public.is_invited_to_event(v_message.event_id, v_uid) or public.is_event_organizer(v_message.event_id)))
      or (v_message.is_secret and public.can_access_secret_space(v_message.event_id))
    ) then
      raise exception 'Message introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.event_id := v_message.event_id;
    new.content_snapshot := v_message.content;

  elsif new.target_type = 'direct_message' then
    select dm.sender_id as user_id, dm.content into v_message
    from public.direct_messages dm
    where dm.id = new.target_id
      and exists (
        select 1 from public.direct_conversation_participants p
        where p.conversation_id = dm.conversation_id and p.user_id = v_uid
      );
    if not found then
      raise exception 'Message introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.content_snapshot := v_message.content;

  else
    select p.id as user_id,
           concat_ws(' · ', nullif(trim(concat_ws(' ', p.first_name, p.name)), ''), '@' || p.username, p.avatar_url) as content
      into v_message
    from public.profiles p where p.id = new.target_id;
    if not found then
      raise exception 'Profil introuvable' using errcode = 'P0002';
    end if;
    new.reported_user_id := v_message.user_id;
    new.content_snapshot := v_message.content;
  end if;

  if new.reported_user_id = v_uid then
    raise exception 'Tu ne peux pas te signaler toi-même.' using errcode = '22023';
  end if;

  new.event_id := case when new.target_type = 'event_message' then new.event_id end;
  new.email_sent_at := null;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prepare_report on public.reports;
create trigger trg_prepare_report
  before insert on public.reports
  for each row execute function public.prepare_report();
