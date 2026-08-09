# DLRide Applications Service

The applications API runs as a Deno HTTP service on Railway and uses Supabase
for Postgres and private document storage.

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
