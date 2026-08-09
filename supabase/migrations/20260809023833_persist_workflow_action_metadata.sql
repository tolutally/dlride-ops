begin;

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
    internal_notes = case
      when p_action = 'request_more_information'
        and nullif(btrim(p_note), '') is not null
      then concat_ws(
        E'\n\n',
        nullif(btrim(v_application.internal_notes), ''),
        btrim(p_note)
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
    jsonb_strip_nulls(jsonb_build_object(
      'application_id', p_application_id,
      'activity_id', v_activity_id,
      'action', p_action,
      'previous_status', v_application.status,
      'new_status', v_new_status,
      'performed_by', p_performed_by,
      'message_to_customer', case
        when p_action = 'request_more_information'
          then btrim(p_message_to_customer)
        else null
      end,
      'internal_note', case
        when p_action = 'request_more_information'
          then nullif(btrim(p_note), '')
        else null
      end,
      'decision_reason', case
        when p_action = 'deny_application'
          then btrim(p_decision_reason)
        else null
      end,
      'note', case
        when p_action = 'cancel_application'
          then nullif(btrim(p_note), '')
        else null
      end
    )),
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

comment on function public.perform_application_workflow_action(
  uuid,
  text,
  uuid,
  text,
  text,
  text
) is 'Service-role-only atomic application workflow transition with action metadata.';

commit;
