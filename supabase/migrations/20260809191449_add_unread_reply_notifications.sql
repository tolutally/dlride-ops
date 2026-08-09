begin;

alter table public.application_messages
  add column if not exists is_read boolean not null default false,
  add column if not exists read_at timestamptz;

alter table public.application_messages
  alter column is_read set default false;

update public.application_messages
set is_read = false
where is_read is null;

alter table public.application_messages
  alter column is_read set not null;

create or replace function public.enforce_application_message_read_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.direction = 'outbound' then
    new.is_read := true;
    new.read_at := coalesce(new.read_at, new.created_at, now());
  elsif new.is_read then
    new.read_at := coalesce(new.read_at, now());
  else
    new.read_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_application_message_read_state
on public.application_messages;

create trigger enforce_application_message_read_state
before insert or update of direction, is_read, read_at
on public.application_messages
for each row
execute function public.enforce_application_message_read_state();

revoke all on function public.enforce_application_message_read_state()
from public, anon, authenticated;

update public.application_messages
set
  is_read = true,
  read_at = coalesce(read_at, created_at, now())
where direction = 'outbound';

update public.application_messages
set read_at = case
  when is_read then coalesce(read_at, created_at, now())
  else null
end
where direction = 'inbound';

alter table public.application_messages
  drop constraint if exists application_messages_read_state_check;

alter table public.application_messages
  add constraint application_messages_read_state_check
  check (
    (is_read = false and read_at is null)
    or (is_read = true and read_at is not null)
  );

create index if not exists application_messages_unread_recent_idx
  on public.application_messages (received_at desc, application_id)
  where
    direction = 'inbound'
    and status = 'matched'
    and application_id is not null
    and is_read = false;

create or replace function public.get_application_unread_reply_counts(
  p_application_ids uuid[]
)
returns table (
  application_id uuid,
  unread_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    message.application_id,
    count(*)::bigint as unread_count
  from public.application_messages as message
  where
    message.application_id = any(coalesce(p_application_ids, '{}'::uuid[]))
    and message.direction = 'inbound'
    and message.status = 'matched'
    and message.is_read = false
  group by message.application_id
$$;

revoke all on function public.get_application_unread_reply_counts(uuid[])
from public, anon;
grant execute on function public.get_application_unread_reply_counts(uuid[])
to authenticated, service_role;

create or replace function public.store_outbound_application_message(
  p_application_id uuid,
  p_sender_email text,
  p_recipient_email text,
  p_subject text,
  p_body_text text,
  p_external_message_id text,
  p_received_at timestamptz,
  p_zoho_message_id text default null,
  p_zoho_thread_id text default null,
  p_in_reply_to text default null,
  p_has_attachments boolean default false
)
returns table (
  id uuid,
  direction text,
  sender_email text,
  recipient_email text,
  subject text,
  body_text text,
  received_at timestamptz,
  is_read boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  insert into public.application_messages as stored_message (
    application_id,
    application_number,
    direction,
    sender_email,
    recipient_email,
    subject,
    body_text,
    external_message_id,
    zoho_message_id,
    zoho_thread_id,
    in_reply_to,
    has_attachments,
    status,
    received_at,
    is_read
  )
  select
    application.id,
    application.application_number,
    'outbound',
    btrim(p_sender_email),
    btrim(p_recipient_email),
    coalesce(p_subject, ''),
    coalesce(p_body_text, ''),
    btrim(p_external_message_id),
    nullif(btrim(p_zoho_message_id), ''),
    nullif(btrim(p_zoho_thread_id), ''),
    nullif(btrim(p_in_reply_to), ''),
    coalesce(p_has_attachments, false),
    'matched',
    p_received_at,
    true
  from public.applications as application
  where application.id = p_application_id
  returning
    stored_message.id,
    stored_message.direction,
    stored_message.sender_email,
    stored_message.recipient_email,
    stored_message.subject,
    stored_message.body_text,
    stored_message.received_at,
    stored_message.is_read;
end;
$$;

revoke all on function public.store_outbound_application_message(
  uuid, text, text, text, text, text, timestamptz, text, text, text, boolean
)
from public, anon, authenticated;
grant execute on function public.store_outbound_application_message(
  uuid, text, text, text, text, text, timestamptz, text, text, text, boolean
)
to service_role;

grant update (is_read, read_at)
on table public.application_messages
to service_role;

comment on column public.application_messages.read_at is
  'Timestamp when staff first viewed an inbound customer message.';

comment on function public.get_application_unread_reply_counts(uuid[]) is
  'Returns unread inbound reply counts only for the requested application IDs.';

comment on function public.store_outbound_application_message(
  uuid, text, text, text, text, text, timestamptz, text, text, text, boolean
) is 'Stores a staff message as read without granting broad insert access to the message table.';

commit;
