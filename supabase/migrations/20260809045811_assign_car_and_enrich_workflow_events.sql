begin;

alter table public.applications
  add column assigned_car text;

drop function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
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
  p_assigned_car text default null
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
      v_new_status := 'approved';
      v_event_type := 'application.approved';
      v_activity_note := concat('Assigned car:', E'\n', v_assigned_car);

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
      v_activity_note := concat(
        'Customer request:',
        E'\n',
        btrim(p_message_to_customer)
      );

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
      if nullif(btrim(p_decision_reason), '') is null then
        raise exception using
          errcode = '23514',
          message = 'decision_reason is required to deny an application';
      end if;
      v_new_status := 'denied';
      v_event_type := 'application.denied';
      v_activity_note := btrim(p_decision_reason);

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
      v_activity_note := v_internal_note;

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
    decision_reason = case
      when p_action = 'deny_application' then btrim(p_decision_reason)
      else decision_reason
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
    'activity_id', v_activity_id,
    'action', p_action,
    'previous_status', v_application.status,
    'new_status', v_new_status,
    'performed_by', p_performed_by,
    'assigned_car', case
      when p_action = 'approve_application' then v_assigned_car
      else null
    end,
    'message_to_customer', case
      when p_action = 'request_more_information'
        then btrim(p_message_to_customer)
      else null
    end,
    'decision_reason', case
      when p_action = 'deny_application'
        then btrim(p_decision_reason)
      else null
    end,
    'note', case
      when p_action = 'cancel_application' then v_internal_note
      else null
    end
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
  text
) from public, anon, authenticated;

grant execute on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
) to service_role;

comment on column public.applications.assigned_car is
  'Vehicle manually assigned by staff when an application is approved.';

comment on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text,
  text
) is 'Service-role-only atomic application workflow transition with customer-safe event metadata.';

commit;
