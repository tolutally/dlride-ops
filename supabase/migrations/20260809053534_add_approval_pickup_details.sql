begin;

alter table public.applications
  add column pickup_date date,
  add column pickup_location text,
  add column pickup_instructions text;

revoke execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
) from service_role;

create function public.perform_application_workflow_action(
  p_application_id uuid,
  p_action text,
  p_performed_by uuid,
  p_message_to_customer text,
  p_decision_reason text,
  p_note text,
  p_assigned_car text,
  p_pickup_date date,
  p_pickup_time time without time zone,
  p_pickup_location text,
  p_pickup_instructions text
)
returns table (
  application_id uuid,
  previous_status text,
  new_status text,
  activity_id uuid,
  event_id uuid,
  event_type text,
  event_payload jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_activity_id uuid;
  v_event_id uuid;
  v_event_payload jsonb;
  v_activity_note text;
  v_internal_note text := nullif(btrim(p_note), '');
  v_assigned_car text := nullif(btrim(p_assigned_car), '');
  v_pickup_location text := nullif(btrim(p_pickup_location), '');
  v_pickup_instructions text := nullif(btrim(p_pickup_instructions), '');
  v_now timestamptz := statement_timestamp();
begin
  if p_action is distinct from 'approve_application' then
    return query
    select result.*
    from public.perform_application_workflow_action(
      p_application_id,
      p_action,
      p_performed_by,
      p_message_to_customer,
      p_decision_reason,
      p_note,
      p_assigned_car
    ) as result;
    return;
  end if;

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

  if v_assigned_car is null then
    raise exception using
      errcode = '23514',
      message = 'assigned_car is required to approve an application';
  end if;

  if p_pickup_date is null then
    raise exception using
      errcode = '23514',
      message = 'pickup_date is required to approve an application';
  end if;

  if p_pickup_date < current_date then
    raise exception using
      errcode = '23514',
      message = 'pickup_date cannot be in the past';
  end if;

  if p_pickup_time is null then
    raise exception using
      errcode = '23514',
      message = 'pickup_time is required to approve an application';
  end if;

  if v_pickup_location is null then
    raise exception using
      errcode = '23514',
      message = 'pickup_location is required to approve an application';
  end if;

  if char_length(coalesce(p_note, '')) > 5000
    or char_length(coalesce(p_pickup_instructions, '')) > 5000
  then
    raise exception using
      errcode = '22001',
      message = 'Approval notes must be 5,000 characters or fewer';
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

  if v_application.status <> 'under_review' then
    raise exception using
      errcode = '23514',
      message = format(
        'Cannot approve an application that is already %s.',
        replace(v_application.status, '_', ' ')
      );
  end if;

  update public.applications
  set
    status = 'approved',
    assigned_car = v_assigned_car,
    pickup_date = p_pickup_date,
    pickup_time = p_pickup_time,
    pickup_location = v_pickup_location,
    pickup_instructions = v_pickup_instructions,
    internal_notes = case
      when v_internal_note is not null
      then concat_ws(
        E'\n\n',
        nullif(btrim(v_application.internal_notes), ''),
        v_internal_note
      )
      else internal_notes
    end,
    reviewed_by = p_performed_by,
    reviewed_at = v_now
  where id = p_application_id;

  v_activity_note := concat(
    'Assigned Car:',
    E'\n',
    v_assigned_car,
    E'\n\nPickup:',
    E'\n',
    to_char(p_pickup_date, 'Mon FMDD, YYYY'),
    ' at ',
    to_char(p_pickup_time, 'FMHH12:MI AM'),
    E'\n\nLocation:',
    E'\n',
    v_pickup_location
  );

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
    'approved',
    v_activity_note,
    p_performed_by,
    v_now
  )
  returning id into v_activity_id;

  v_event_payload := jsonb_strip_nulls(jsonb_build_object(
    'application_id', p_application_id,
    'application_number', v_application.application_number,
    'first_name', v_application.first_name,
    'email', v_application.email,
    'assigned_car', v_assigned_car,
    'pickup_date', to_char(p_pickup_date, 'YYYY-MM-DD'),
    'pickup_time', to_char(p_pickup_time, 'HH24:MI'),
    'pickup_location', v_pickup_location,
    'pickup_instructions', coalesce(v_pickup_instructions, ''),
    'activity_id', v_activity_id,
    'action', p_action,
    'previous_status', v_application.status,
    'new_status', 'approved'
  ));

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
    'application.approved',
    v_event_payload,
    v_now
  )
  returning id into v_event_id;

  return query
  select
    p_application_id,
    v_application.status,
    'approved'::text,
    v_activity_id,
    v_event_id,
    'application.approved'::text,
    v_event_payload,
    v_now;
end;
$$;

revoke execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  text
) to service_role;

comment on column public.applications.pickup_date is
  'Confirmed customer pickup date supplied during approval.';

comment on column public.applications.pickup_location is
  'Confirmed customer-facing pickup location supplied during approval.';

comment on column public.applications.pickup_instructions is
  'Optional customer-facing pickup instructions supplied during approval.';

comment on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text,
  date,
  time without time zone,
  text,
  text
) is 'Service-role-only workflow entry point with atomic pickup-detail approval.';

commit;
