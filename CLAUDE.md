# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Winston is a white-labeled, multi-tenant AI agent platform for SMBs (starting with cannabis dispensaries) built on top of OpenClaw. It provides managed SaaS hosting with onboarding, billing, credit metering, and operational tooling.

**Core Principle:** Wrap, don't fork. OpenClaw runs unmodified in tenant containers. All Winston-specific logic lives in surrounding services.

## Architecture

### System Components

```
Tenant requests → Winston API → LLM Proxy (CRITICAL) → LLM Providers (Moonshot/Anthropic/OpenAI)
                              → PostgreSQL
                              → Railway Tenant Containers (OpenClaw)
```

### LLM Proxy Pattern (Critical)

**ALL tenant LLM traffic MUST route through the LLM Proxy service.** No tenant container talks directly to any LLM API.

Why this matters:
- Neither Anthropic nor Moonshot support programmatic API key creation
- Centralizes all LLM spend under Winston's accounts
- Enables credit metering and enforcement
- Allows model switching without container restarts
- Tenant containers never see real API keys

The proxy holds all real API keys, routes based on tenant's selected model, counts tokens, deducts credits, and enforces credit limits.

### Multi-Tenant Isolation

- One OpenClaw gateway container per tenant (Railway services)
- Each container has its own persistent volume
- Configs generated dynamically from baseline template + tenant overrides
- Sealed Railway variables for secrets

### Credit System

Credits map to LLM token usage: 1 credit = 1,000 tokens at default Kimi K2.5 model.

Model multipliers:
- Kimi K2.5: 1.0x (default)
- GPT-4o: 3.0x
- Claude Sonnet 4.5: 5.0x
- Claude Opus 4.6: 12.0x

When credits exhausted, proxy returns structured error. Agent displays pre-baked message (no LLM call needed).

## Monorepo Structure

```
packages/
  web/          Next.js - tenant onboarding (7-step flow) + dashboard
  admin/        Next.js - Winston team management dashboard
  api/          Node.js/Express - provisioning, config generation, health
  proxy/        Node.js/Express - LLM routing, metering, credit enforcement
  sync/         Node.js worker - container logs → Postgres

skills/         Curated skill library (dispensary + generic)
docker/         OpenClaw tenant container image
```

## Development Commands

### Setup (once monorepo is initialized)
```bash
# Install dependencies for all packages
npm install

# Set up database
psql $DATABASE_URL < packages/api/src/db/schema.sql

# Start all services in development
npm run dev
```

### Development
```bash
# Run specific package
npm run dev --workspace=packages/web
npm run dev --workspace=packages/proxy

# Build all packages
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Provisioning (once API is built)
```bash
# Create a test tenant
curl -X POST http://localhost:3001/api/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Dispensary", "email": "test@example.com", "tier": "free"}'

# Check tenant health
curl http://localhost:3001/api/tenants/{id}/health
```

### Railway Deployment
```bash
# Deploy specific service
railway up --service winston-api

# View logs
railway logs --service winston-proxy

# Restart tenant container
railway restart --service tenant-{id}
```

## Key Technical Decisions

### Config Management
- **Baseline template** (`openclaw-base.json`) contains platform defaults
- **Tenant overrides** stored in Postgres, merged at deploy time
- Updates: merge new baseline → preserve tenant customizations → restart gateway
- Version tracking: `winston.baselineVersion` field in config

### Channel Selection
- **Default: Telegram** (simplest setup, most reliable)
- WebChat: embedded JS snippet from Winston CDN
- Slack: OAuth flow
- WhatsApp: requires periodic re-authentication (less reliable)

### Skill Management
- Curated library ships with all tenants
- Agents CAN create their own skills
- Winston team reviews agent-created skills via admin dashboard

### Connector Access
- Self-service: tenants toggle read-only ↔ read-write in dashboard
- Keys stored as Railway sealed variables
- Reference records in `tenant_connectors` table

### Default Model
- **Kimi K2.5** via Moonshot API (76% cheaper than Claude)
- Use direct provider APIs (not OpenRouter) for cost optimization
- Tenants can switch models; credit multiplier adjusts burn rate

## Database Schema Key Tables

- `tenants` - org records, credit balances, tier, selected model
- `tenant_instances` - Railway service mapping, health status
- `config_snapshots` - versioned configs for rollback
- `credit_usage` - token consumption audit trail
- `session_transcripts` - synced from container JSONL, 90-day retention
- `channel_health` - track disconnections (especially WhatsApp)

## Onboarding Flow

7-step wizard generates:
1. Account & Payment (Stripe) → tenant record
2. Website Analysis (Claude Sonnet scrape) → business context
3. Agent Identity → SOUL.md personality
4. Business Questions → AGENTS.md capabilities, may suggest sub-agents
5. Channels → Telegram/Slack/WhatsApp/WebChat setup
6. Connectors → API key input (optional)
7. Launch → provision container, deploy config, start gateway

Target: <10 minutes from landing page to live agent.

## Provisioning Pipeline

When "Launch Agent" clicked, API service:
1. Generate configs (openclaw.json, SOUL.md, AGENTS.md, USER.md, IDENTITY.md)
2. Copy curated skills based on industry
3. Create Railway service via Railway API
4. Set sealed environment variables
5. Mount persistent volume at `/data`
6. Start OpenClaw gateway
7. Register with log sync worker
8. Initialize credit balance

## Sub-Agent Pattern

When business questions indicate multiple use cases (e.g., customer-facing + internal ops), provision sub-agents in single gateway:
- Separate SOUL.md and workspace per sub-agent
- Route by channel binding (webchat = customer, telegram = ops)
- Isolated sessions (no cross-talk)

## Development Phases

### Phase 1 (Weeks 1-2): Foundation
- LLM proxy with multi-model routing
- Baseline config template
- Manual single-tenant deployment proof
- Credit exhaustion flow testing

### Phase 2 (Weeks 3-4): Provisioning Automation
- Railway API integration
- Config generation pipeline
- Website analysis endpoint (<10 sec)
- Log sync worker

### Phase 3 (Weeks 5-6): Onboarding & Tenant Dashboard
- 7-step onboarding flow
- Tenant self-service dashboard
- WebChat widget
- Stripe integration

### Phase 4 (Weeks 7-8): Management & Operations
- Winston admin dashboard
- Session audit/replay
- Backup/restore
- Health monitoring & alerts
- Onboard 20 pilot tenants

## Important Constraints

### Security
- Never expose real LLM API keys to tenants
- Use Railway sealed variables for secrets
- Default connector access: read-only
- Tenant containers isolated, no shared state

### Performance
- Website analysis must complete <10 seconds
- Onboarding flow target: <10 minutes total
- LLM proxy must not add significant latency

### Cost Optimization
- Default to Kimi K2.5 (cheapest model)
- Show credit impact when switching models
- 90-day session retention to limit storage costs
- No rate limiting (simplifies POC, revisit if abuse)

## Credit Exhaustion UX

When credits hit zero:
1. Proxy returns `402 Payment Required` with `winston_credits_exhausted` error
2. Agent's SOUL.md includes pre-baked exhaustion message (no LLM call)
3. Container stays running (no shutdown)
4. Dashboard shows upgrade CTA
5. Credits refresh on rolling 30-day cycle from signup

## Operational Runbook

### Tenant Health Issues
- WhatsApp disconnection: notify tenant, provide QR re-scan instructions
- Credits exhausted: grant temporary credits or send upgrade nudge
- Gateway unresponsive: check Railway logs, consider restart

### Config Updates
- Edit baseline template in repo
- Push to all tenants via admin dashboard
- Merge preserves tenant overrides
- Rolling restart minimizes downtime

### Skill Review
- Check agent-created skills weekly in admin dashboard
- Review SKILL.md for security concerns
- Approve or reject
- Can push approved skills to other tenants

## File Generation Templates

Location: `packages/api/src/templates/`

- `openclaw-base.json` - baseline OpenClaw config (model provider, channels, tool policies)
- `soul-dispensary.md` - SOUL.md template for cannabis dispensaries
- `soul-generic.md` - SOUL.md template for generic SMBs
- `agents-dispensary.md` - AGENTS.md capabilities for dispensaries
- `identity.md` - agent name/emoji/vibe template

Variables in templates use `{{VARIABLE}}` syntax, replaced by provisioner.

## Testing Strategy

### Unit Tests
- Config generation logic
- Credit calculation with model multipliers
- Model routing in proxy

### Integration Tests
- Full provisioning pipeline (creates real Railway service)
- LLM proxy request flow (Moonshot, Anthropic, OpenAI)
- Credit exhaustion behavior
- WebChat widget embed

### Load Tests
- 20 concurrent tenants
- Credit deduction accuracy under load
- Railway container stability

## Target Metrics

- Onboarding completion: >80% of signups
- Time to first message: <10 minutes
- Website analysis: <10 seconds
- Credit calculation accuracy: 100%
- Tenant container uptime: >99.5%
- Session transcript retention: 90 days
- Pilot target: 20 dispensary tenants in 8 weeks
