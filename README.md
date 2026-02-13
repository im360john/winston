# Winston

Multi-tenant AI agent platform built around OpenClaw, with tenant provisioning on Railway and a Winston sidecar API for live file/config management.

## Repo Docs (Source Of Truth)

- `docs/RAILWAY.md`: Production deployment + provisioning notes (Railway, Postgres, tenant services).
- `docs/ADMIN.md`: Winston admin portal behavior (including sidecar/setup proxy routes).
- `CLAUDE.md`: Architecture + dev notes for coding agents (kept current; not a status log).

## Quick Dev

```bash
npm install
DATABASE_URL=postgres://... npm run db:migrate
npm run dev
```

