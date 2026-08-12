# DLRide Applications Service

The applications API runs as a Deno HTTP service on Railway and uses Supabase
for Postgres and private document storage.

## Private applications API

The applications API has no public Railway or custom domain. Trusted services
reach it over Railway private networking at:

```text
http://dlride-api.railway.internal:8000
```

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Service health check |
| `POST` | `/applications` | Internal bearer token + Turnstile token | Submit a rental application |

All other routes are currently unsupported. The additional operations in
`api/openapi.yaml` are planned contracts, not live endpoints.

### Health check

```bash
curl http://dlride-api.railway.internal:8000/health
```

Successful response:

```json
{"status":"ok"}
```

### Submit an application

`POST /applications` requires `multipart/form-data`, a valid Cloudflare
Turnstile token, and `Authorization: Bearer <INTERNAL_API_TOKEN>`. Only trusted
server-side services may hold this credential; browsers must never receive it.

| Field | Type | Required | Accepted values or notes |
| --- | --- | --- | --- |
| `first_name` | Text | Yes | |
| `last_name` | Text | Yes | |
| `street_address` | Text | Yes | |
| `city` | Text | Yes | |
| `state` | Text | Yes | |
| `postal_code` | Text | Yes | |
| `phone` | Text | Yes | |
| `email` | Text | Yes | Valid email address |
| `rental_start_date` | Date | Yes | `YYYY-MM-DD`; today or later |
| `rental_end_date` | Date | Yes | At least 7 days after start |
| `pickup_time` | Time | Yes | Local time in 24-hour `HH:MM` format |
| `dropoff_time` | Time | Yes | Local time in 24-hour `HH:MM` format |
| `intended_vehicle_use` | Text | Yes | `gig_work`, `essential_weekly_transportation`, `essential_weekly_use`, `road_trips`, `personal_use`, `travel_nursing`, or `other` |
| `payment_method` | Text | Yes | `cash`, `e-transfer`, or `card` |
| `additional_information` | Text | No | |
| `sms_consent` | Text | Yes | Must be `true` |
| `company_name` | Text | Yes | Honeypot; must be empty |
| `cf-turnstile-response` | Text | Yes | Browser-generated Turnstile token |
| `drivers_license` | File | Yes | JPEG, PNG, or PDF; maximum 10 MB |
| `proof_of_address` | File | Yes | JPEG, PNG, or PDF; maximum 10 MB |

Example request:

```bash
curl --request POST \
	http://dlride-api.railway.internal:8000/applications \
	--header 'Authorization: Bearer <INTERNAL_API_TOKEN>' \
	--form 'first_name=Taylor' \
	--form 'last_name=Rider' \
	--form 'street_address=100 Main Street' \
	--form 'city=Calgary' \
	--form 'state=Alberta' \
	--form 'postal_code=T2P 1J9' \
	--form 'phone=+1 403 555 0100' \
	--form 'email=taylor@example.com' \
	--form 'rental_start_date=2026-09-01' \
	--form 'rental_end_date=2026-09-15' \
	--form 'pickup_time=09:30' \
	--form 'dropoff_time=17:00' \
	--form 'intended_vehicle_use=gig_work' \
	--form 'payment_method=card' \
	--form 'sms_consent=true' \
	--form 'company_name=' \
	--form 'cf-turnstile-response=<TURNSTILE_TOKEN>' \
	--form 'drivers_license=@./drivers-license.pdf' \
	--form 'proof_of_address=@./proof-of-address.pdf'
```

Successful response (`201`):

```json
{
	"success": true,
	"data": {
		"id": "550e8400-e29b-41d4-a716-446655440000",
		"application_number": "DLR-000001",
		"status": "under_review",
		"rental_weeks": 2,
		"created_at": "2026-09-01T12:00:00.000Z"
	}
}
```

Errors use this shape:

```json
{
	"success": false,
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "First name is required.",
		"details": [{"field": "first_name", "message": "First name is required."}]
	}
}
```

Common statuses are `400`, `403`, `413`, `415`, `422`, `429`, and `500`.
Submissions are limited to five attempts per source IP per rolling hour.

## Railway deployment

Create a Railway service from this repository. Railway detects the root
`Dockerfile` and uses `railway.json` to check `GET /health` before promoting a
deployment.

Configure these service variables in Railway:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred) or `SUPABASE_SERVICE_ROLE_KEY`
- `TURNSTILE_SECRET`
- `INTERNAL_API_TOKEN` (a long, randomly generated server-only secret)

Do not configure `PORT`; Railway provides it automatically. Do not generate a
Railway domain or attach a custom domain to the API service. Server-side callers
must use its `RAILWAY_PRIVATE_DOMAIN` and include `INTERNAL_API_TOKEN`.
The Supabase migrations in `supabase/migrations` must be applied to the target
project before the service receives submissions.

## DLride Ops staff authentication

The internal Next.js routes use Supabase Auth with staff email and password.
There is no public registration flow.

The repository's default `/railway.json` deploys the Ops UI. Attach the custom
domain `ops.dlride.com` to that service. Railway supplies `PORT`; do not add it
as a service variable. The service health check is `GET /health`.

If the applications API is deployed as a separate Railway service, set that
service variable `SERVICE_IMAGE=api`; the shared root Dockerfile will then select
the private Deno API image instead of the default Ops image. The mail-sync cron
continues to use `/railway.mail-sync.json`.

The public entry point `/` redirects to `/login`. Authenticated staff who visit
`/login` are redirected to `/applications`, and a successful sign-in also lands
on the application queue.

Configure the Next.js runtime with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (or the existing service-role fallback)

Apply all migrations in `supabase/migrations` before signing in. The staff
access migration grants authenticated read access to applications and their
activity while preserving service-only workflow writes and private document
signing.

To create the first staff member:

1. Open the Supabase Dashboard and select **Authentication → Users**.
2. Select **Add user → Create new user**.
3. Enter the staff email and a strong temporary password, and confirm the user.
4. Under **Authentication → Providers → Email**, disable new-user sign-ups so
   accounts can only be created manually by project administrators.
5. Give the credentials to the staff member through a secure channel, then sign
   in at `/login`.

## Zoho Mail connection

DLride Ops connects to the actual `hello@dlride.com` Zoho mailbox and uses
`applications@dlride.com` as its configured Send Mail As address and inbound
alias. Zoho API calls and inbound synchronization are isolated in
`lib/zoho-mail`.

The OAuth client must register this exact callback URL:

```text
https://<your-ops-domain>/api/auth/zoho/callback
```

For initial setup, configure `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, a strong
temporary `ZOHO_SETUP_SECRET`, and set `ZOHO_OAUTH_SETUP_ENABLED=true`. Set
`ZOHO_ACCOUNTS_BASE_URL` to the account's regional Zoho Accounts domain. Then
visit:

```text
https://<your-ops-domain>/api/auth/zoho/connect?setup_secret=<ZOHO_SETUP_SECRET>
```

The flow requests only `ZohoMail.accounts.READ`, `ZohoMail.messages.READ`, and
`ZohoMail.messages.CREATE`, validates OAuth state in an HttpOnly cookie, selects
the exact `hello@dlride.com` account, and displays the refresh token and account
ID once. Copy the result into Railway secrets.

Normal production operation requires:

- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_MAIL_ACCOUNT_ID`
- `ZOHO_MAIL_ADDRESS=hello@dlride.com`
- `ZOHO_MAIL_FROM_ALIAS=applications@dlride.com`
- `ZOHO_ACCOUNTS_BASE_URL` for the mailbox data center
- `ZOHO_MAIL_API_BASE_URL` for the same mailbox data center

After setup, set `ZOHO_OAUTH_SETUP_ENABLED=false` and remove
`ZOHO_SETUP_SECRET`. The refresh-token service will then obtain and cache short-
lived access tokens without another browser authorization.

For a deliberate live connection test, set the three local-only `ZOHO_TEST_*`
values in `.env.local` and run `npm run zoho:test`. The reply message must be a
dedicated test message; the script never chooses a customer conversation for
you.

## Inbound application mail synchronization

Apply all migrations before starting the worker. The inbound migration creates
the `application_messages` and `message_attachments` tables, the service-only
atomic ingestion function, and the private `application-email-attachments`
bucket. Browser clients receive no direct Storage access.

The one-shot worker command is:

```bash
npm run sync:mail
```

It requires the normal Zoho variables above plus `SUPABASE_URL` and
`SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).
`ZOHO_MAIL_SYNC_LIMIT` is optional and defaults to 100, with a hard maximum of
200 messages per run. For local execution, either export the variables first or
run the underlying Deno command with `--env-file=.env.local`.

On Railway, create a separate cron service from this repository, set its custom
config path to `/railway.mail-sync.json`, and set
`RAILWAY_DOCKERFILE_PATH=Dockerfile.mail-sync`. The config schedules the worker
every five minutes with `*/5 * * * *`. The worker exits after one polling pass;
it must not replace the web service or run inside a browser request. Copy the
same Zoho and Supabase server secrets into the cron service. Do not add a public
health check to the one-shot cron service.
