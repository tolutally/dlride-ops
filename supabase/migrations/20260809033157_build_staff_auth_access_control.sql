begin;

alter table public.applications enable row level security;
alter table public.application_activity enable row level security;

revoke all on table public.applications from anon;
revoke insert, update, delete on table public.applications from authenticated;
grant select on table public.applications to authenticated;

drop policy if exists "Authenticated staff can read applications"
on public.applications;

create policy "Authenticated staff can read applications"
on public.applications
for select
to authenticated
using ((select auth.uid()) is not null);

revoke all on table public.application_activity from anon;
revoke insert, update, delete on table public.application_activity from authenticated;
grant select on table public.application_activity to authenticated;

drop policy if exists "Authenticated staff can read application activity"
on public.application_activity;

create policy "Authenticated staff can read application activity"
on public.application_activity
for select
to authenticated
using ((select auth.uid()) is not null);

-- Application updates and activity inserts remain restricted to the existing
-- service-role-only workflow functions. The app authenticates the staff member
-- before calling those functions and passes auth.users.id as performed_by.

update storage.buckets
set public = false
where id = 'application-documents';

-- No storage.objects SELECT policy is intentionally created. Staff document
-- access is authorized by the Next.js server, which then uses the service role
-- to issue a five-minute signed URL. Anonymous and direct client reads remain
-- denied by Storage RLS.

commit;
