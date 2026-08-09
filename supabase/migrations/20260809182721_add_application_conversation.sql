begin;

alter table public.application_messages
  add column is_read boolean not null default false;

update public.application_messages
set is_read = true
where direction = 'outbound';

create index application_messages_application_unread_idx
  on public.application_messages (application_id, received_at desc)
  where direction = 'inbound' and is_read = false;

grant update (is_read) on table public.application_messages to service_role;

comment on column public.application_messages.is_read is
  'False for newly synchronized inbound messages until staff opens the application conversation.';

commit;
