begin;

create extension if not exists pgcrypto;

create type public.application_vehicle_use as enum (
  'gig_work',
  'road_trips',
  'personal_use',
  'travel_nursing',
  'other'
);

create sequence public.applications_application_number_seq
  as bigint
  minvalue 1
  maxvalue 999999
  start with 1
  increment by 1
  no cycle;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique
    default ('DLR-' || lpad(nextval('public.applications_application_number_seq'::regclass)::text, 6, '0')),

  first_name text not null,
  last_name text not null,
  street_address text not null,
  city text not null,
  state text not null,
  postal_code text not null,
  phone text not null,
  email text not null,

  rental_start_date date not null,
  rental_end_date date not null,
  rental_weeks integer not null,
  intended_vehicle_use public.application_vehicle_use not null,
  payment_method text not null,
  additional_information text,

  drivers_license_path text not null,
  proof_of_address_path text not null,

  sms_consent boolean not null default false,

  status text not null default 'submitted',

  internal_notes text,
  decision_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint applications_application_number_format_check
    check (application_number ~ '^DLR-[0-9]{6}$'),
  constraint applications_first_name_required_check
    check (btrim(first_name) <> ''),
  constraint applications_last_name_required_check
    check (btrim(last_name) <> ''),
  constraint applications_street_address_required_check
    check (btrim(street_address) <> ''),
  constraint applications_city_required_check
    check (btrim(city) <> ''),
  constraint applications_state_required_check
    check (btrim(state) <> ''),
  constraint applications_postal_code_required_check
    check (btrim(postal_code) <> ''),
  constraint applications_phone_required_check
    check (btrim(phone) <> ''),
  constraint applications_email_format_check
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint applications_rental_dates_order_check
    check (rental_end_date > rental_start_date),
  constraint applications_minimum_rental_period_check
    check ((rental_end_date - rental_start_date) >= 7),
  constraint applications_rental_weeks_positive_check
    check (rental_weeks > 0),
  constraint applications_payment_method_required_check
    check (btrim(payment_method) <> ''),
  constraint applications_drivers_license_storage_path_check
    check (drivers_license_path = id::text || '/drivers-license.jpg'),
  constraint applications_proof_of_address_storage_path_check
    check (proof_of_address_path = id::text || '/proof-of-address.jpg'),
  constraint applications_sms_consent_required_check
    check (sms_consent is true),
  constraint applications_status_check
    check (
      status in (
        'submitted',
        'under_review',
        'more_information_required',
        'approved',
        'denied',
        'cancelled'
      )
    )
);

alter sequence public.applications_application_number_seq
  owned by public.applications.application_number;

comment on column public.applications.payment_method is
  'Required website form value. Add an allowed-values CHECK constraint when the website option values are supplied.';
comment on column public.applications.drivers_license_path is
  'Private storage object path only; never a URL.';
comment on column public.applications.proof_of_address_path is
  'Private storage object path only; never a URL.';

create index applications_email_idx
  on public.applications (email);

create index applications_status_idx
  on public.applications (status);

create index applications_rental_start_date_idx
  on public.applications (rental_start_date);

create index applications_created_at_idx
  on public.applications (created_at);

create or replace function public.validate_and_calculate_application_rental()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  rental_days integer;
begin
  if new.rental_start_date is null then
    raise exception using
      errcode = '23502',
      message = 'rental_start_date is required';
  end if;

  if new.rental_end_date is null then
    raise exception using
      errcode = '23502',
      message = 'rental_end_date is required';
  end if;

  if tg_op = 'INSERT'
     or new.rental_start_date is distinct from old.rental_start_date then
    if new.rental_start_date < current_date then
      raise exception using
        errcode = '23514',
        message = 'Rental Start Date cannot be in the past',
        constraint = 'applications_rental_start_date_not_past_check';
    end if;
  end if;

  rental_days := new.rental_end_date - new.rental_start_date;

  if rental_days <= 0 then
    raise exception using
      errcode = '23514',
      message = 'Rental End Date must be after Rental Start Date',
      constraint = 'applications_rental_dates_order_check';
  end if;

  if rental_days < 7 then
    raise exception using
      errcode = '23514',
      message = 'Minimum rental period is 7 days',
      constraint = 'applications_minimum_rental_period_check';
  end if;

  new.rental_weeks := ceil(rental_days::numeric / 7)::integer;

  return new;
end;
$$;

create trigger applications_validate_and_calculate_rental
before insert or update on public.applications
for each row
execute function public.validate_and_calculate_application_rental();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger applications_set_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();

alter table public.applications enable row level security;

-- RLS POLICY PLACEHOLDERS
--
-- No application policies are activated by this migration. With RLS enabled,
-- API access is denied by default until the staff authorization model is added.
-- Replace the example app_metadata check below with the project's authoritative
-- staff-role check before enabling any policy.
--
-- create policy "Staff can read applications"
-- on public.applications
-- for select
-- to authenticated
-- using ((auth.jwt() -> 'app_metadata' ->> 'staff') = 'true');
--
-- create policy "Staff can update applications"
-- on public.applications
-- for update
-- to authenticated
-- using ((auth.jwt() -> 'app_metadata' ->> 'staff') = 'true')
-- with check ((auth.jwt() -> 'app_metadata' ->> 'staff') = 'true');

insert into storage.buckets (
  id,
  name,
  public,
  allowed_mime_types
)
values (
  'application-documents',
  'application-documents',
  false,
  array['image/jpeg']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  allowed_mime_types = excluded.allowed_mime_types;

-- STORAGE RLS POLICY PLACEHOLDER
--
-- The bucket is private and no storage.objects policy is activated here, so
-- authenticated users cannot read objects by default. Once staff identity is
-- represented authoritatively in JWT app_metadata, the following SELECT policy
-- allows qualifying staff to create signed URLs while keeping public access off.
--
-- create policy "Staff can read application documents for signed URLs"
-- on storage.objects
-- for select
-- to authenticated
-- using (
--   bucket_id = 'application-documents'
--   and (auth.jwt() -> 'app_metadata' ->> 'staff') = 'true'
--   and (storage.foldername(name))[1] ~
--     '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
--   and storage.filename(name) in (
--     'drivers-license.jpg',
--     'proof-of-address.jpg'
--   )
-- );

commit;
