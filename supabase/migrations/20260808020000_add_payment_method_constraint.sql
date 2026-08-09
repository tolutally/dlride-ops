begin;

alter table public.applications
  add constraint applications_payment_method_allowed_values_check
    check (payment_method in ('cash', 'e-transfer', 'card'));

comment on column public.applications.payment_method is
  'Website payment method: cash, e-transfer, or card.';

commit;
