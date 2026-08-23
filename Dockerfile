ARG SERVICE_IMAGE=ops

FROM node:22-bookworm-slim AS ops

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]

FROM denoland/deno:2.9.5 AS api

WORKDIR /app

COPY --chown=deno:deno deno.json ./
COPY --chown=deno:deno supabase/functions/applications ./supabase/functions/applications
COPY --chown=deno:deno supabase/functions/_shared ./supabase/functions/_shared

RUN deno cache supabase/functions/applications/index.ts

USER deno

EXPOSE 8000

CMD ["run", "--allow-env=PORT,SUPABASE_URL,SUPABASE_SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY,TURNSTILE_SECRET,INTERNAL_API_TOKEN,LEADS_API_TOKEN,MAILTRAP_API_TOKEN,MAILTRAP_FROM_EMAIL,MAILTRAP_FROM_NAME,MAILTRAP_REPLY_TO_EMAIL,MAILTRAP_REPLY_TO_NAME,MAILTRAP_TEMPLATE_APPLICATION_RECEIVED,MAILTRAP_TEMPLATE_APPLICATION_APPROVED,MAILTRAP_TEMPLATE_MORE_INFORMATION_REQUIRED,MAILTRAP_TEMPLATE_APPLICATION_DENIED,MAILTRAP_TEMPLATE_APPLICATION_CANCELLED", "--allow-net", "supabase/functions/applications/index.ts"]

FROM ${SERVICE_IMAGE} AS final
