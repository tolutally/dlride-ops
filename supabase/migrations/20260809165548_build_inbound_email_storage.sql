begin;

create table public.application_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid
    references public.applications (id) on delete restrict,
  application_number text,
  direction text not null,
  sender_email text not null,
  recipient_email text not null,
  subject text not null,
  body_text text not null,
  body_html text,
  external_message_id text not null unique,
  zoho_message_id text,
  zoho_thread_id text,
  in_reply_to text,
  has_attachments boolean not null default false,
  status text not null,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint application_messages_direction_check
    check (direction in ('inbound', 'outbound')),
  constraint application_messages_status_check
    check (status in ('matched', 'unmatched', 'failed')),
  constraint application_messages_application_number_format_check
    check (
      application_number is null
      or application_number ~ '^DLR-[0-9]{6}$'
    ),
  constraint application_messages_external_id_required_check
    check (btrim(external_message_id) <> ''),
  constraint application_messages_sender_required_check
    check (btrim(sender_email) <> ''),
  constraint application_messages_recipient_required_check
    check (btrim(recipient_email) <> ''),
  constraint application_messages_match_consistency_check
    check (
      (status = 'matched' and application_id is not null and application_number is not null)
      or (status = 'unmatched' and application_id is null)
      or (
        status = 'failed'
        and (application_id is null or application_number is not null)
      )
    )
);

create unique index application_messages_zoho_message_id_unique_idx
  on public.application_messages (zoho_message_id)
  where zoho_message_id is not null;

create index application_messages_application_received_idx
  on public.application_messages (application_id, received_at desc);

create index application_messages_status_received_idx
  on public.application_messages (status, received_at desc);

create index application_messages_application_number_idx
  on public.application_messages (application_number)
  where application_number is not null;

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references public.application_messages (id) on delete cascade,
  filename text not null,
  mime_type text not null,
  storage_path text not null unique,
  file_size bigint not null,
  created_at timestamptz not null default now(),

  constraint message_attachments_filename_required_check
    check (btrim(filename) <> ''),
  constraint message_attachments_mime_type_check
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint message_attachments_file_size_check
    check (file_size > 0 and file_size <= 10485760),
  constraint message_attachments_storage_path_check
    check (
      btrim(storage_path) <> ''
      and storage_path !~* '^(https?|data):'
      and storage_path !~ '(^|/)\.\.(/|$)'
    )
);

create index message_attachments_message_created_idx
  on public.message_attachments (message_id, created_at);

alter table public.application_messages enable row level security;
alter table public.message_attachments enable row level security;

revoke all on table public.application_messages from anon;
revoke insert, update, delete on table public.application_messages from authenticated;
grant select on table public.application_messages to authenticated;
grant select on table public.application_messages to service_role;
grant update (status) on table public.application_messages to service_role;

create policy "Authenticated staff can read application messages"
on public.application_messages
for select
to authenticated
using ((select auth.uid()) is not null);

revoke all on table public.message_attachments from anon;
revoke insert, update, delete on table public.message_attachments from authenticated;
grant select on table public.message_attachments to authenticated;
grant select, insert on table public.message_attachments to service_role;

create policy "Authenticated staff can read message attachments"
on public.message_attachments
for select
to authenticated
using ((select auth.uid()) is not null);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'application-email-attachments',
  'application-email-attachments',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policy is created. The polling worker and the existing
-- authenticated server use the service role for uploads and short-lived signed
-- URLs. The private bucket therefore cannot be listed or read by browser clients.

alter table public.application_activity
  drop constraint application_activity_action_check;

alter table public.application_activity
  add constraint application_activity_action_check
    check (
      action in (
        'application_created',
        'request_more_information',
        'resume_review',
        'approve_application',
        'deny_application',
        'cancel_application',
        'internal_notes_updated',
        'customer_replied'
      )
    );

create function public.store_inbound_application_message(
  p_application_number text,
  p_sender_email text,
  p_recipient_email text,
  p_subject text,
  p_body_text text,
  p_external_message_id text,
  p_received_at timestamptz,
  p_body_html text default null,
  p_zoho_message_id text default null,
  p_zoho_thread_id text default null,
  p_in_reply_to text default null,
  p_has_attachments boolean default false
)
returns table (
  message_id uuid,
  application_id uuid,
  message_status text,
  inserted boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requested_application_number text := nullif(upper(btrim(p_application_number)), '');
  v_application_id uuid;
  v_application_number text;
  v_application_status text;
  v_message_id uuid;
  v_existing_application_id uuid;
  v_existing_status text;
  v_message_status text;
  v_received_at timestamptz := coalesce(p_received_at, statement_timestamp());
begin
  if v_requested_application_number is not null
    and v_requested_application_number !~ '^DLR-[0-9]{6}$'
  then
    v_requested_application_number := null;
  end if;

  if nullif(btrim(p_external_message_id), '') is null then
    raise exception using
      errcode = '22023',
      message = 'external_message_id is required';
  end if;

  if nullif(btrim(p_sender_email), '') is null then
    raise exception using
      errcode = '22023',
      message = 'sender_email is required';
  end if;

  if nullif(btrim(p_recipient_email), '') is null then
    raise exception using
      errcode = '22023',
      message = 'recipient_email is required';
  end if;

  select
    message.id,
    message.application_id,
    message.status
  into
    v_message_id,
    v_existing_application_id,
    v_existing_status
  from public.application_messages as message
  where message.external_message_id = btrim(p_external_message_id)
    or (
      nullif(btrim(p_zoho_message_id), '') is not null
      and message.zoho_message_id = btrim(p_zoho_message_id)
    )
  order by message.created_at
  limit 1;

  if found then
    return query
    select
      v_message_id,
      v_existing_application_id,
      v_existing_status,
      false;
    return;
  end if;

  if v_requested_application_number is not null then
    select
      application.id,
      application.application_number,
      application.status
    into
      v_application_id,
      v_application_number,
      v_application_status
    from public.applications as application
    where application.application_number = v_requested_application_number;
  end if;

  v_message_status := case
    when v_application_id is null then 'unmatched'
    else 'matched'
  end;

  insert into public.application_messages (
    application_id,
    application_number,
    direction,
    sender_email,
    recipient_email,
    subject,
    body_text,
    body_html,
    external_message_id,
    zoho_message_id,
    zoho_thread_id,
    in_reply_to,
    has_attachments,
    status,
    received_at
  )
  values (
    v_application_id,
    coalesce(v_application_number, v_requested_application_number),
    'inbound',
    btrim(p_sender_email),
    btrim(p_recipient_email),
    coalesce(p_subject, ''),
    coalesce(p_body_text, ''),
    p_body_html,
    btrim(p_external_message_id),
    nullif(btrim(p_zoho_message_id), ''),
    nullif(btrim(p_zoho_thread_id), ''),
    nullif(btrim(p_in_reply_to), ''),
    coalesce(p_has_attachments, false),
    v_message_status,
    v_received_at
  )
  on conflict do nothing
  returning id into v_message_id;

  if v_message_id is null then
    select
      message.id,
      message.application_id,
      message.status
    into
      v_message_id,
      v_existing_application_id,
      v_existing_status
    from public.application_messages as message
    where message.external_message_id = btrim(p_external_message_id)
      or (
        nullif(btrim(p_zoho_message_id), '') is not null
        and message.zoho_message_id = btrim(p_zoho_message_id)
      )
    order by message.created_at
    limit 1;

    if v_message_id is null then
      raise exception using
        errcode = '23505',
        message = 'Unable to resolve the conflicting inbound message';
    end if;

    return query
    select
      v_message_id,
      v_existing_application_id,
      v_existing_status,
      false;
    return;
  end if;

  if v_application_id is not null then
    insert into public.application_activity (
      application_id,
      action,
      previous_status,
      new_status,
      note,
      performed_by,
      created_at
    )
    values (
      v_application_id,
      'customer_replied',
      v_application_status,
      v_application_status,
      format('Message reference: %s', v_message_id),
      null,
      v_received_at
    );
  end if;

  return query
  select
    v_message_id,
    v_application_id,
    v_message_status,
    true;
end;
$$;

revoke execute on function public.store_inbound_application_message(
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.store_inbound_application_message(
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean
) to service_role;

comment on table public.application_messages is
  'Inbound and outbound application correspondence; HTML is stored untrusted and must be sanitized before display.';

comment on column public.application_messages.external_message_id is
  'Authoritative RFC Message-ID when available, otherwise a deterministic Zoho-scoped fallback.';

comment on column public.message_attachments.storage_path is
  'Private application-email-attachments bucket path only; never a URL.';

comment on function public.store_inbound_application_message(
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  text,
  text,
  text,
  text,
  boolean
) is
  'Service-role-only idempotent inbound message ingestion with exact application-number matching and Customer Replied activity.';

commit;
