begin;

alter table public.applications
  add column cancellation_note text;

drop function public.perform_application_workflow_action(
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
);

drop function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
);

create function public.perform_application_workflow_action(
  p_application_id uuid,
  p_action text,
  p_performed_by uuid,
  p_message_to_customer text default null,
  p_decision_reason text default null,
  p_note text default null,
  p_assigned_car text default null,
  p_pickup_date date default null,
  p_pickup_time time without time zone default null,
  p_pickup_location text default null,
  p_pickup_instructions text default null,
  p_cancellation_note text default null
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
  v_new_status text;
  v_activity_id uuid;
  v_event_id uuid;
  v_event_type text;
  v_event_payload jsonb;
  v_activity_note text;
  v_internal_note text := nullif(btrim(p_note), '');
  v_assigned_car text := nullif(btrim(p_assigned_car), '');
  v_pickup_location text := nullif(btrim(p_pickup_location), '');
  v_pickup_instructions text := nullif(btrim(p_pickup_instructions), '');
  v_message_to_customer text := nullif(btrim(p_message_to_customer), '');
  v_decision_reason text := nullif(btrim(p_decision_reason), '');
  v_cancellation_note text := nullif(btrim(p_cancellation_note), '');
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

  if char_length(coalesce(p_note, '')) > 5000
    or char_length(coalesce(p_message_to_customer, '')) > 5000
    or char_length(coalesce(p_decision_reason, '')) > 5000
    or char_length(coalesce(p_pickup_instructions, '')) > 5000
    or char_length(coalesce(p_cancellation_note, '')) > 5000
  then
    raise exception using
      errcode = '22001',
      message = 'Workflow text must be 5,000 characters or fewer';
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
      v_new_status := 'approved';
      v_event_type := 'application.approved';
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

    when 'request_more_information' then
      if v_application.status <> 'under_review' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot request more information for an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      if v_message_to_customer is null then
        raise exception using
          errcode = '23514',
          message = 'message_to_customer is required to request more information';
      end if;
      v_new_status := 'more_information_required';
      v_event_type := 'application.more_information_requested';
      v_activity_note := concat('Customer request:', E'\n', v_message_to_customer);

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
      v_activity_note := v_internal_note;

    when 'deny_application' then
      if v_application.status <> 'under_review' then
        raise exception using
          errcode = '23514',
          message = format(
            'Cannot deny an application that is already %s.',
            replace(v_application.status, '_', ' ')
          );
      end if;
      v_new_status := 'denied';
      v_event_type := 'application.denied';
      v_activity_note := v_decision_reason;

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
      v_activity_note := v_cancellation_note;

    else
      raise exception using
        errcode = '22023',
        message = format('Unknown workflow action: %s', coalesce(p_action, '<null>'));
  end case;

  update public.applications
  set
    status = v_new_status,
    assigned_car = case
      when p_action = 'approve_application' then v_assigned_car
      else assigned_car
    end,
    pickup_date = case
      when p_action = 'approve_application' then p_pickup_date
      else pickup_date
    end,
    pickup_time = case
      when p_action = 'approve_application' then p_pickup_time
      else pickup_time
    end,
    pickup_location = case
      when p_action = 'approve_application' then v_pickup_location
      else pickup_location
    end,
    pickup_instructions = case
      when p_action = 'approve_application' then v_pickup_instructions
      else pickup_instructions
    end,
    decision_reason = case
      when p_action = 'deny_application' then v_decision_reason
      else decision_reason
    end,
    cancellation_note = case
      when p_action = 'cancel_application' then v_cancellation_note
      else cancellation_note
    end,
    internal_notes = case
      when p_action in ('approve_application', 'request_more_information')
        and v_internal_note is not null
      then concat_ws(
        E'\n\n',
        nullif(btrim(v_application.internal_notes), ''),
        v_internal_note
      )
      else internal_notes
    end,
    reviewed_by = case
      when p_action in ('approve_application', 'deny_application') then p_performed_by
      else reviewed_by
    end,
    reviewed_at = case
      when p_action in ('approve_application', 'deny_application') then v_now
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
    v_activity_note,
    p_performed_by,
    v_now
  )
  returning id into v_activity_id;

  v_event_payload := jsonb_build_object(
    'application_id', p_application_id,
    'application_number', v_application.application_number,
    'first_name', v_application.first_name,
    'email', v_application.email,
    'activity_id', v_activity_id,
    'action', p_action,
    'previous_status', v_application.status,
    'new_status', v_new_status
  ) || case p_action
    when 'approve_application' then jsonb_build_object(
      'assigned_car', v_assigned_car,
      'pickup_date', to_char(p_pickup_date, 'YYYY-MM-DD'),
      'pickup_time', to_char(p_pickup_time, 'HH24:MI'),
      'pickup_location', v_pickup_location,
      'pickup_instructions', coalesce(v_pickup_instructions, '')
    )
    when 'request_more_information' then jsonb_build_object(
      'message_to_customer', v_message_to_customer
    )
    when 'deny_application' then jsonb_build_object(
      'decision_reason', coalesce(v_decision_reason, '')
    )
    when 'cancel_application' then jsonb_build_object(
      'cancellation_note', coalesce(v_cancellation_note, '')
    )
    else '{}'::jsonb
  end;

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
    v_event_payload,
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
  text,
  text
) to service_role;

comment on column public.applications.cancellation_note is
  'Optional customer-facing cancellation note supplied by staff.';

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
  text,
  text
) is 'Service-role-only atomic workflow transition with email-safe customer payloads.';

commit;
