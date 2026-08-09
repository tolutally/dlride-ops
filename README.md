# DLRide Applications Service

The applications API runs as a Deno HTTP service on Railway and uses Supabase
for Postgres and private document storage.

## Live API

Base URL: `https://dlride-ops-production.up.railway.app`

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Service health check |
| `POST` | `/applications` | Turnstile token | Submit a rental application |

All other routes are currently unsupported. The additional operations in
`api/openapi.yaml` are planned contracts, not live endpoints.

### Health check

```bash
curl https://dlride-ops-production.up.railway.app/health
```

Successful response:

```json
{"status":"ok"}
```

### Submit an application

`POST /applications` requires `multipart/form-data`. It is public and does not
use bearer authentication, but it requires a valid Cloudflare Turnstile token.

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
| `intended_vehicle_use` | Text | Yes | `gig_work`, `road_trips`, `personal_use`, `travel_nursing`, or `other` |
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
	https://dlride-ops-production.up.railway.app/applications \
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
		"status": "submitted",
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

Do not configure `PORT`; Railway provides it automatically. The application
submission endpoint accepts `POST` requests at the generated Railway domain.
The Supabase migrations in `supabase/migrations` must be applied to the target
project before the service receives submissions.
