# Railway Deploy + Provisioning (Winston)

This is the current, maintained Railway doc. If another markdown file disagrees with this one, treat it as archived.

## Railway Project

- Project: `winston-poc`
- Environment: `production`

## Services

- `winston-api`: tenant CRUD + provisioning + tenant instance registry
- `winston-admin`: admin portal (Next.js) for tenant health + file/config editing
- `winston-llm-proxy`: LLM routing + credit metering (tenants never see provider keys)
- `Postgres`: shared DB
- `tenant-*`: one Railway service per tenant (OpenClaw gateway + Winston sidecar API)

## CLI Auth

Railway CLI expects `RAILWAY_API_TOKEN` (not `RAILWAY_TOKEN`):

```bash
export RAILWAY_API_TOKEN=...
```

## Deploying

If a service is configured with a `rootDirectory` in Railway, deploy from the repo root so that directory exists in the upload archive:

```bash
railway up --service winston-api
railway up --service winston-admin
```

## DB Schema / Migrations

Use the migration runner:

```bash
DATABASE_URL=postgres://... npm run db:migrate
```

Notes:
- `packages/api/src/db/schema.sql` is written to be safe for fresh installs.
- Incremental SQL migrations live in `packages/api/src/db/migrations/`.

## Tenant Provisioning (High Level)

`winston-api` provisions a tenant by:

1. Creating/updating DB rows in `tenants` and `tenant_instances`
2. Creating a Railway service for the tenant
3. Attaching a persistent volume at `/data`
4. Generating a public domain for the tenant service
5. Writing initial config files via the tenant sidecar API
6. Recording file versions in `file_snapshots`

## Sidecar API

Each tenant exposes a Winston sidecar API that reads/writes files under the tenant state directory (typically `/data/.openclaw`).

Important behavior:
- The sidecar reports `state_dir` via health.
- The file API is relative to `state_dir`.
  - Example: `/data/.openclaw/openclaw.json` is accessed as `openclaw.json` via the sidecar.

Common endpoints (from the tenant domain):
- `GET /winston/health`
- `GET /winston/changes`
- `GET /winston/files/<path>`
- `PUT /winston/files/<path>` with JSON body `{ "content": "..." }`

## Admin Portal: Sidecar Access Model

The browser does not talk directly to tenant domains.

`winston-admin` proxies sidecar/setup requests via its own Next route handlers under:
- `/api/tenants/:id/sidecar/*`
- `/api/tenants/:id/setup/*`

This avoids CORS issues and prevents sidecar tokens from being exposed client-side.

## OpenClaw Version Pin

The tenant image builds OpenClaw from source and is pinned via `docker/openclaw-tenant/Dockerfile` (`OPENCLAW_GIT_REF`).

If you change `openclaw.json` via the sidecar, keep it schema-valid for the pinned OpenClaw version. Adding arbitrary keys can make OpenClaw reject the config.
