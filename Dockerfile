FROM denoland/deno:2.9.5

WORKDIR /app

COPY --chown=deno:deno deno.json ./
COPY --chown=deno:deno supabase/functions/applications ./supabase/functions/applications

RUN deno cache supabase/functions/applications/index.ts

USER deno

EXPOSE 8000

CMD ["run", "--allow-env=PORT,SUPABASE_URL,SUPABASE_SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY,TURNSTILE_SECRET", "--allow-net", "supabase/functions/applications/index.ts"]