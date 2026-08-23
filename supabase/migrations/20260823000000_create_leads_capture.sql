begin;

create table public.leads (
  id uuid primary key default gen_random_uuid(),

  first_name text not null,
  last_name text,
  email text not null,
  phone text,
  message text,

  source text not null default 'botpress',
  status text not null default 'new',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_first_name_required_check
    check (btrim(first_name) <> ''),
  constraint leads_email_format_check
    check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint leads_source_required_check
    check (btrim(source) <> ''),
  constraint leads_status_check
    check (
      status in (
        'new',
        'contacted',
        'qualified',
        'converted',
        'disqualified'
      )
    )
);

comment on table public.leads is
  'Prospect contact details captured by external lead sources (e.g. the Botpress chat widget).';
comment on column public.leads.source is
  'Identifies the originating integration, e.g. botpress, website, referral.';

create index leads_created_at_idx
  on public.leads (created_at desc);

create index leads_status_idx
  on public.leads (status);

create index leads_email_idx
  on public.leads (email);

create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

alter table public.leads enable row level security;

revoke all on table public.leads from anon;
revoke insert, update, delete on table public.leads from authenticated;
grant select on table public.leads to authenticated;

create policy "Authenticated staff can read leads"
on public.leads
for select
to authenticated
using ((select auth.uid()) is not null);

-- Inserts are performed only by the private API service using the service
-- role key, matching the applications submission trust model.

commit;
