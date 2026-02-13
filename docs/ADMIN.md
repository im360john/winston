# Winston Admin Portal

## Sidecar + Setup Connectivity

The admin UI uses server-side proxy routes so the browser never calls tenant domains directly.

Reasons:
- Avoids CORS failures across `tenant-*.up.railway.app` domains
- Prevents leaking per-tenant sidecar tokens to the browser

Proxy routes live under `packages/admin/src/app/api/tenants/[id]/`:

- Sidecar:
  - `/api/tenants/:id/sidecar/health`
  - `/api/tenants/:id/sidecar/changes`
  - `/api/tenants/:id/sidecar/files/*`
- OpenClaw setup helpers:
  - `/api/tenants/:id/setup/status`
  - `/api/tenants/:id/setup/restart`
  - `/api/tenants/:id/setup/healthz`

## Next.js Config Gotcha

Do not add a blanket rewrite of `/api/*` to `winston-api`. The admin app implements its own Next route handlers under `/api/*`, and a rewrite will break them in production.

See: `packages/admin/next.config.js`.

