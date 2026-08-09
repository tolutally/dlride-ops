begin;

create schema if not exists private;
revoke all on schema private from public;

create table public.application_activity (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.applications (id) on delete restrict,
  action text not null,
  previous_status text,
  new_status text not null,
  note text,
  performed_by uuid,
  created_at timestamptz not null default now(),

  constraint application_activity_action_check
    check (
      action in (
        'application_created',
        'request_more_information',
        'resume_review',
        'approve_application',
        'deny_application',
        'cancel_application'
      )
    ),
  constraint application_activity_previous_status_check
    check (
      previous_status is null
      or previous_status in (
        'under_review',
        'more_information_required',
        'approved',
        'denied',
        'cancelled'
      )
    ),
  constraint application_activity_new_status_check
    check (
      new_status in (
        'under_review',
        'more_information_required',
        'approved',
        'denied',
        'cancelled'
      )
    )
);

create index application_activity_application_created_idx
  on public.application_activity (application_id, created_at);

create table public.application_workflow_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.applications (id) on delete restrict,
  activity_id uuid not null
    references public.application_activity (id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint application_workflow_events_type_check
    check (
      event_type in (
        'application.review_started',
        'application.more_information_requested',
        'application.review_resumed',
        'application.approved',
        'application.denied',
        'application.cancelled'
      )
    )
);

create index application_workflow_events_application_created_idx
  on public.application_workflow_events (application_id, created_at);

create index application_workflow_events_type_created_idx
  on public.application_workflow_events (event_type, created_at);

alter table public.application_activity enable row level security;
alter table public.application_workflow_events enable row level security;

revoke all on table public.application_activity from anon, authenticated;
revoke all on table public.application_workflow_events from anon, authenticated;
revoke insert, update, delete on table public.application_activity from service_role;
revoke insert, update, delete on table public.application_workflow_events from service_role;
grant select on table public.application_activity to service_role;
grant select on table public.application_workflow_events to service_role;

create or replace function private.prevent_workflow_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'Workflow history is append-only and cannot be modified';
end;
$$;

create trigger application_activity_append_only
before update or delete on public.application_activity
for each row
execute function private.prevent_workflow_history_mutation();

create trigger application_workflow_events_append_only
before update or delete on public.application_workflow_events
for each row
execute function private.prevent_workflow_history_mutation();

revoke execute on function private.prevent_workflow_history_mutation()
from public, anon, authenticated, service_role;

alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  alter column status set default 'under_review';

update public.applications
set status = 'under_review'
where status = 'submitted';

alter table public.applications
  add constraint applications_status_check
    check (
      status in (
        'under_review',
        'more_information_required',
        'approved',
        'denied',
        'cancelled'
      )
    );

create or replace function private.enforce_application_initial_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'under_review' then
    raise exception using
      errcode = '23514',
      message = 'New applications must enter the workflow under review',
      constraint = 'applications_initial_status_check';
  end if;

  return new;
end;
$$;

create trigger applications_enforce_initial_state
before insert on public.applications
for each row
execute function private.enforce_application_initial_state();

revoke execute on function private.enforce_application_initial_state()
from public, anon, authenticated, service_role;

insert into public.application_activity (
  application_id,
  action,
  previous_status,
  new_status,
  note,
  performed_by,
  created_at
)
select
  application.id,
  'application_created',
  null,
  application.status,
  'Application Created',
  null,
  application.created_at
from public.applications as application
where not exists (
  select 1
  from public.application_activity as activity
  where activity.application_id = application.id
    and activity.action = 'application_created'
);

insert into public.application_workflow_events (
  application_id,
  activity_id,
  event_type,
  payload,
  created_at
)
select
  activity.application_id,
  activity.id,
  'application.review_started',
  jsonb_build_object(
    'application_id', activity.application_id,
    'previous_status', activity.previous_status,
    'new_status', activity.new_status,
    'action', activity.action
  ),
  activity.created_at
from public.application_activity as activity
where activity.action = 'application_created'
  and activity.new_status = 'under_review'
  and not exists (
    select 1
    from public.application_workflow_events as event
    where event.activity_id = activity.id
      and event.event_type = 'application.review_started'
  );

create or replace function private.record_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
begin
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
    new.id,
    'application_created',
    null,
    new.status,
    'Application Created',
    null,
    new.created_at
  )
  returning id into v_activity_id;

  insert into public.application_workflow_events (
    application_id,
    activity_id,
    event_type,
    payload,
    created_at
  )
  values (
    new.id,
    v_activity_id,
    'application.review_started',
    jsonb_build_object(
      'application_id', new.id,
      'application_number', new.application_number,
      'previous_status', null,
      'new_status', new.status,
      'action', 'application_created'
    ),
    new.created_at
  );

  return new;
end;
$$;

create trigger applications_record_creation_activity
after insert on public.applications
for each row
execute function private.record_application_created();

revoke execute on function private.record_application_created()
from public, anon, authenticated, service_role;

revoke execute on function public.validate_and_calculate_application_rental()
from public, anon, authenticated;

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

create or replace function public.perform_application_workflow_action(
  p_application_id uuid,
  p_action text,
  p_performed_by uuid,
  p_message_to_customer text default null,
  p_decision_reason text default null,
  p_note text default null
)
returns table (
  application_id uuid,
  previous_status text,
  new_status text,
  activity_id uuid,
  event_id uuid,
  event_type text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_new_status text;
  v_activity_id uuid;
  v_event_id uuid;
  v_event_type text;
  v_note text;
  v_now timestamptz := statement_timestamp();
begin
  if p_application_id is null then
    raise exception using
      errcode = '22023',
      message = 'Application ID is required';
  end if;

  if p_performed_by is null then
    raise exception using
      errcode = '22023',
      message = 'performed_by is required for workflow actions';
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

  case p_action
    when 'approve_application' then
      if v_application.status <> 'under_review' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot approve an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      v_new_status := 'approved';
      v_event_type := 'application.approved';
      v_note := nullif(btrim(p_note), '');

    when 'request_more_information' then
      if v_application.status <> 'under_review' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot request more information for an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      if nullif(btrim(p_message_to_customer), '') is null then
        raise exception using
          errcode = '23514',
          message = 'message_to_customer is required to request more information';
      end if;
      v_new_status := 'more_information_required';
      v_event_type := 'application.more_information_requested';
      v_note := btrim(p_message_to_customer);

    when 'resume_review' then
      if v_application.status <> 'more_information_required' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot resume review for an application that is %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      v_new_status := 'under_review';
      v_event_type := 'application.review_resumed';
      v_note := nullif(btrim(p_note), '');

    when 'deny_application' then
      if v_application.status <> 'under_review' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot deny an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      if nullif(btrim(p_decision_reason), '') is null then
        raise exception using
          errcode = '23514',
          message = 'decision_reason is required to deny an application';
      end if;
      v_new_status := 'denied';
      v_event_type := 'application.denied';
      v_note := btrim(p_decision_reason);

    when 'cancel_application' then
      if v_application.status not in ('under_review', 'more_information_required') then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot cancel an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      v_new_status := 'cancelled';
      v_event_type := 'application.cancelled';
      v_note := nullif(btrim(p_note), '');

    else
      raise exception using
        errcode = '22023',
        message = format('Unknown workflow action: %s', coalesce(p_action, '<null>'));
  end case;

  update public.applications
  set
    status = v_new_status,
    decision_reason = case
      when p_action = 'deny_application' then btrim(p_decision_reason)
      else decision_reason
    end,
    reviewed_by = case
      when p_action in ('approve_application', 'deny_application')
        then p_performed_by
      else reviewed_by
    end,
    reviewed_at = case
      when p_action in ('approve_application', 'deny_application')
        then v_now
      else reviewed_at
    end
  where id = p_application_id;

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
    p_action,
    v_application.status,
    v_new_status,
    v_note,
    p_performed_by,
    v_now
  )
  returning id into v_activity_id;

  insert into public.application_workflow_events (
    application_id,
    activity_id,
    event_type,
    payload,
    created_at
  )
  values (
    p_application_id,
    v_activity_id,
    v_event_type,
    jsonb_build_object(
      'application_id', p_application_id,
      'activity_id', v_activity_id,
      'action', p_action,
      'previous_status', v_application.status,
      'new_status', v_new_status,
      'performed_by', p_performed_by
    ),
    v_now
  )
  returning id into v_event_id;

  return query
  select
    p_application_id,
    v_application.status,
    v_new_status,
    v_activity_id,
    v_event_id,
    v_event_type,
    v_now;
end;
$$;

revoke execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text
) to service_role;

revoke update on table public.applications from anon, authenticated, service_role;
grant select, insert on table public.applications to service_role;

comment on table public.application_activity is
  'Append-only workflow action history for rental applications.';
comment on table public.application_workflow_events is
  'Append-only transactional outbox of application workflow events.';
comment on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text
) is 'Service-role-only atomic application workflow transition.';

commit;
