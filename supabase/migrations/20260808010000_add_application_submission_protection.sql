begin;

create table public.application_submission_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  attempted_at timestamptz not null default now(),

  constraint application_submission_attempts_ip_hash_check
    check (ip_hash ~ '^[0-9a-f]{64}$')
);

create index application_submission_attempts_ip_time_idx
  on public.application_submission_attempts (ip_hash, attempted_at);

alter table public.application_submission_attempts enable row level security;

comment on table public.application_submission_attempts is
  'Server-only rolling rate-limit events. Stores SHA-256 IP hashes, never raw IP addresses.';

create or replace function public.consume_application_submission_limit(
  p_ip_hash text
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_attempt_count integer;
  v_oldest_attempt timestamptz;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'A valid SHA-256 IP hash is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_ip_hash, 0)
  );

  delete from public.application_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at <= v_now - interval '1 hour';

  select count(*), min(attempted_at)
  into v_attempt_count, v_oldest_attempt
  from public.application_submission_attempts
  where ip_hash = p_ip_hash
    and attempted_at > v_now - interval '1 hour';

  if v_attempt_count >= 5 then
    return query
    select
      false,
      greatest(
        1,
        ceil(
          extract(epoch from (v_oldest_attempt + interval '1 hour' - v_now))
        )::integer
      );
    return;
  end if;

  insert into public.application_submission_attempts (ip_hash, attempted_at)
  values (p_ip_hash, v_now);

  return query select true, 0;
end;
$$;

revoke all on table public.application_submission_attempts from public;
revoke all on table public.application_submission_attempts from anon;
revoke all on table public.application_submission_attempts from authenticated;
grant select, insert, delete on table public.application_submission_attempts to service_role;

revoke all on function public.consume_application_submission_limit(text) from public;
revoke all on function public.consume_application_submission_limit(text) from anon;
revoke all on function public.consume_application_submission_limit(text) from authenticated;
grant execute on function public.consume_application_submission_limit(text) to service_role;

alter table public.applications
  drop constraint applications_drivers_license_storage_path_check,
  drop constraint applications_proof_of_address_storage_path_check;

alter table public.applications
  add constraint applications_drivers_license_storage_path_check
    check (
      drivers_license_path in (
        id::text || '/drivers-license.jpg',
        id::text || '/drivers-license.png',
        id::text || '/drivers-license.pdf'
      )
    ),
  add constraint applications_proof_of_address_storage_path_check
    check (
      proof_of_address_path in (
        id::text || '/proof-of-address.jpg',
        id::text || '/proof-of-address.png',
        id::text || '/proof-of-address.pdf'
      )
    );

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'application/pdf'
  ]
where id = 'application-documents';

commit;
