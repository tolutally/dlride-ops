begin;

alter table public.applications
  add column pickup_time time without time zone,
  add column dropoff_time time without time zone;

alter table public.applications
  add constraint applications_rental_times_complete_check
  check (
    (pickup_time is null and dropoff_time is null)
    or (pickup_time is not null and dropoff_time is not null)
  );

comment on column public.applications.pickup_time is
  'Customer-requested local pickup time for the rental start date.';

comment on column public.applications.dropoff_time is
  'Customer-requested local drop-off time for the rental end date.';

commit;
