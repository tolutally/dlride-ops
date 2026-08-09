begin;

create or replace function public.update_application_internal_notes(
  p_application_id uuid,
  p_internal_notes text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_at timestamptz;
begin
  if p_application_id is null then
    raise exception using
      errcode = '22023',
      message = 'Application ID is required';
  end if;

  if char_length(coalesce(p_internal_notes, '')) > 10000 then
    raise exception using
      errcode = '22001',
      message = 'Internal notes must be 10,000 characters or fewer';
  end if;

  update public.applications
  set internal_notes = nullif(btrim(p_internal_notes), '')
  where id = p_application_id
  returning updated_at into v_updated_at;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'Application not found';
  end if;

  return v_updated_at;
end;
$$;

revoke execute on function public.update_application_internal_notes(uuid, text)
from public, anon, authenticated;

grant execute on function public.update_application_internal_notes(uuid, text)
to service_role;

comment on function public.update_application_internal_notes(uuid, text) is
  'Service-role-only update for the non-workflow internal_notes field.';

commit;
