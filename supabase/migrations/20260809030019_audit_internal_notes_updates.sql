begin;

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
        'internal_notes_updated'
      )
    );

drop function if exists public.update_application_internal_notes(uuid, text);

create function public.update_application_internal_notes(
  p_application_id uuid,
  p_internal_notes text,
  p_performed_by uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_normalized_notes text := nullif(btrim(p_internal_notes), '');
  v_updated_at timestamptz;
begin
  if p_application_id is null then
    raise exception using
      errcode = '22023',
      message = 'Application ID is required';
  end if;

  if p_performed_by is null then
    raise exception using
      errcode = '22023',
      message = 'performed_by is required for internal note updates';
  end if;

  if char_length(coalesce(p_internal_notes, '')) > 10000 then
    raise exception using
      errcode = '22001',
      message = 'Internal notes must be 10,000 characters or fewer';
  end if;

  select application.*
  into v_application
  from public.applications as application
  where application.id = p_application_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Application not found';
  end if;

  update public.applications
  set internal_notes = v_normalized_notes
  where id = p_application_id
  returning updated_at into v_updated_at;

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
    p_application_id,
    'internal_notes_updated',
    v_application.status,
    v_application.status,
    coalesce(v_normalized_notes, 'Internal notes cleared.'),
    p_performed_by,
    v_updated_at
  );

  return v_updated_at;
end;
$$;

revoke execute on function public.update_application_internal_notes(uuid, text, uuid)
from public, anon, authenticated;

grant execute on function public.update_application_internal_notes(uuid, text, uuid)
to service_role;

comment on function public.update_application_internal_notes(uuid, text, uuid) is
  'Service-role-only atomic internal notes update with append-only activity audit.';

comment on table public.application_activity is
  'Append-only audit trail for application workflow actions and internal note updates.';

commit;
