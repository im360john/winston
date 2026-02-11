# OpenClaw Baseline Configuration

This directory contains Winston's baseline OpenClaw configuration templates.

## Configuration Strategy

**Baseline Template + Tenant Overrides = Final Config**

- `openclaw-base.json` - Platform-wide defaults, security policies, tool restrictions
- Tenant overrides (stored in Postgres) - Agent name, personality, channels, connectors
- Final config is merged at deployment time and written to tenant container

## Template Variables

Variables in `{{BRACKETS}}` are replaced by the provisioner during tenant creation:

### Required
- `{{TENANT_ID}}` - UUID of tenant from database
- `{{TIER}}` - Subscription tier (free, starter, growth, enterprise)
- `{{GATEWAY_TOKEN}}` - Randomly generated auth token for gateway
- `{{LLM_PROXY_URL}}` - URL of Winston LLM proxy service
- `{{SELECTED_MODEL}}` - Tenant's model choice (kimi-k2.5, claude-sonnet-4-5, etc.)

### Channel Configuration
- `{{TELEGRAM_ENABLED}}` - true/false
- `{{TELEGRAM_BOT_TOKEN}}` - If enabled
- `{{SLACK_ENABLED}}` - true/false
- `{{WHATSAPP_ENABLED}}` - true/false

## Model Configuration

All models route through Winston's LLM proxy (`{{LLM_PROXY_URL}}`).

The proxy:
1. Receives request with `Authorization: Bearer winston-{{TENANT_ID}}`
2. Looks up tenant's selected model
3. Routes to correct provider (Moonshot, Anthropic, OpenAI)
4. Counts tokens and deducts credits
5. Returns response with credit headers

### Available Models

| Model | Provider | Credit Multiplier | Use Case |
|-------|----------|-------------------|----------|
| kimi-k2.5 | Moonshot | 1.0x (baseline) | Default - most affordable |
| claude-sonnet-4-5 | Anthropic | 5.0x | Better reasoning, higher quality |
| claude-opus-4-6 | Anthropic | 12.0x | Most capable, premium |
| gpt-4o | OpenAI | 3.0x | Alternative option |

## Tool Policy

Default: **Read-only**

Allowed tools:
- `read` - Read files, memory
- `web_search` - Search the internet
- `memory_search` - Search agent's memory
- `memory_get` - Retrieve specific memories

Denied tools (tenant can't enable without Winston approval):
- `exec` - Execute code
- `write` - Write files
- `edit` - Edit files
- `browser` - Full browser control
- `cron` - Scheduled tasks
- `nodes` - JavaScript runtime

Rationale: Security and resource management. Tenants who need write access can toggle in dashboard (updates tool policy + restarts gateway).

## Memory Configuration

- **Enabled**: Yes
- **Session memory**: Yes (experimental)
- **Sources**: memory files + session history
- **Context overflow**: Auto-compact at 60K tokens

## Updating Baseline Config

When you need to update all tenants:

1. Edit `openclaw-base.json`
2. Bump `winston.baselineVersion`
3. Use Winston Admin Dashboard → Config → "Push Baseline Update"
4. System will:
   - Load each tenant's current config
   - Deep-merge new baseline (preserving tenant overrides)
   - Write updated config to container volume
   - Rolling restart gateways

## Testing

Test config generation:

```bash
node packages/api/src/services/config-generator.js test
```

Validate a generated config:

```bash
# Generate config for test tenant
node packages/api/src/services/provisioner.js --tenant-id=<uuid> --dry-run

# Validate with OpenClaw (when available)
openclaw validate config.json
```

## Security Notes

1. **Never commit**: `GATEWAY_TOKEN`, `TELEGRAM_BOT_TOKEN`, connector API keys
2. **LLM API keys**: Stored only in LLM proxy service (never in tenant configs)
3. **Railway sealed variables**: Used for all secrets in deployed containers
4. **Tool restrictions**: Enforced at gateway level, can't be bypassed by agent

## Next Steps (Phase 2)

- [ ] Build config-generator.js service
- [ ] Build provisioner.js for tenant creation
- [ ] Create SOUL.md, AGENTS.md, USER.md, IDENTITY.md templates
- [ ] Test full config generation pipeline
