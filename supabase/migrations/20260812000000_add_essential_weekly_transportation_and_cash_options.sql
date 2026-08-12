begin;

-- Add 'essential_weekly_transportation' and ensure 'essential_weekly_use' in public.application_vehicle_use enum
alter type public.application_vehicle_use add value if not exists 'essential_weekly_transportation';
alter type public.application_vehicle_use add value if not exists 'essential_weekly_use';

-- Explicitly ensure applications_payment_method_allowed_values_check constraint on public.applications includes cash, e-transfer, card
alter table public.applications
  drop constraint if exists applications_payment_method_allowed_values_check;

alter table public.applications
  add constraint applications_payment_method_allowed_values_check
    check (lower(payment_method) in ('cash', 'e-transfer', 'card'));

comment on column public.applications.payment_method is
  'Website payment method: cash, e-transfer, or card.';

commit;
