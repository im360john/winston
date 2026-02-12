# Winston Tenant Container

This directory contains the Docker wrapper for OpenClaw tenant containers. It implements the **"wrap, don't fork"** principle by running vanilla OpenClaw alongside a Winston sidecar API.

## Architecture

```
┌─────────────────────────────────────┐
│   Winston Tenant Container          │
│                                     │
│  ┌────────────┐  ┌──────────────┐  │
│  │ OpenClaw   │  │ Sidecar API  │  │
│  │ (vanilla)  │  │ (Winston)    │  │
│  │ Port 18789 │  │ Port 18790   │  │
│  └─────┬──────┘  └──────┬───────┘  │
│        │                │          │
│        └────────┬───────┘          │
│                 │                  │
│         ┌───────▼────────┐         │
│         │  /data/ Volume │         │
│         └────────────────┘         │
└─────────────────────────────────────┘
```

## Components

### 1. OpenClaw Gateway (Vanilla)
- Official OpenClaw installation, completely unmodified
- Runs on port 18789
- Manages agent conversations, skills, memory
- Reads/writes files to `/data/` volume

### 2. Winston Sidecar API
- Lightweight Node.js HTTP server
- Runs on port 18790
- Provides live file read/write access
- Tracks file changes (agent vs admin modifications)
- Enables zero-downtime config updates

## Files

- `Dockerfile` - Multi-stage build (OpenClaw + sidecar wrapper)
- `sidecar.js` - HTTP API for file management
- `entrypoint.sh` - Starts both OpenClaw and sidecar
- `package.json` - Sidecar dependencies
- `docker-compose.test.yml` - Local testing setup
- `test-sidecar.sh` - API test script
- `schema-updates.sql` - Database schema for file tracking

## Local Testing

### 1. Build the container

```bash
cd docker/openclaw-tenant
docker-compose -f docker-compose.test.yml build
```

### 2. Start the container

```bash
docker-compose -f docker-compose.test.yml up
```

You should see:
```
🔧 Winston Sidecar API
📡 Listening on 0.0.0.0:18790
🗂️  Data directory: /data
```

### 3. Test the sidecar API

In another terminal:

```bash
chmod +x test-sidecar.sh
./test-sidecar.sh
```

Or test manually:

```bash
# Health check
curl -H "Authorization: Bearer test-token-123" \
  http://localhost:18790/health | jq

# List files
curl -H "Authorization: Bearer test-token-123" \
  http://localhost:18790/files | jq

# Create a file
curl -X PUT \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"content":"# My Soul\n\nFriendly agent"}' \
  http://localhost:18790/files/SOUL.md | jq

# Read it back
curl -H "Authorization: Bearer test-token-123" \
  http://localhost:18790/files/SOUL.md | jq

# View changes
curl -H "Authorization: Bearer test-token-123" \
  http://localhost:18790/changes | jq
```

### 4. Inspect the volume

```bash
docker-compose -f docker-compose.test.yml exec winston-tenant-test sh

# Inside container
ls -la /data/
cat /data/SOUL.md
cat /data/.winston/changes.jsonl
```

## Sidecar API Reference

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "winston-sidecar",
  "uptime": 123.45,
  "tenant_id": "test-tenant-001"
}
```

### `GET /files?path=<directory>`
List directory contents.

**Response:**
```json
{
  "path": "",
  "items": [
    {
      "name": "SOUL.md",
      "type": "file",
      "size": 1234,
      "modified": "2026-02-12T10:30:00.000Z"
    },
    {
      "name": "skills",
      "type": "directory",
      "size": null,
      "modified": "2026-02-12T10:30:00.000Z"
    }
  ]
}
```

### `GET /files/<path>`
Read file contents.

**Response:**
```json
{
  "path": "SOUL.md",
  "content": "# Agent Soul\n\n...",
  "size": 1234,
  "modified": "2026-02-12T10:30:00.000Z",
  "hash": "abc123..."
}
```

### `PUT /files/<path>`
Write file contents.

**Request:**
```json
{
  "content": "# New content\n\nHello world"
}
```

**Response:**
```json
{
  "success": true,
  "path": "SOUL.md",
  "size": 28,
  "hash": "def456..."
}
```

### `GET /changes?limit=<number>`
View recent file changes.

**Response:**
```json
{
  "changes": [
    {
      "timestamp": "2026-02-12T10:30:00.000Z",
      "path": "SOUL.md",
      "source": "admin",
      "action": "update"
    },
    {
      "timestamp": "2026-02-12T10:25:00.000Z",
      "path": "skills/my-skill/SKILL.md",
      "source": "agent",
      "action": "create"
    }
  ]
}
```

## Environment Variables

- `TENANT_ID` (required) - Unique tenant identifier
- `WINSTON_SIDECAR_TOKEN` (required) - Authentication token for sidecar API
- `NODE_ENV` - Set to 'production' in Railway

## Security

- Sidecar API requires Bearer token authentication
- Path traversal protection (cannot access files outside `/data/`)
- `.winston` directory is protected from writes
- All file operations are logged

## Deployment to Railway

1. Build and push image to Railway's registry
2. Set environment variables in Railway dashboard
3. Mount persistent volume at `/data`
4. Expose both ports (18789 for OpenClaw, 18790 for sidecar)

## Troubleshooting

### Sidecar not responding
```bash
# Check if sidecar is running
docker-compose exec winston-tenant-test ps aux | grep node

# Check sidecar logs
docker-compose logs -f winston-tenant-test
```

### OpenClaw not starting
The current Dockerfile uses a placeholder for OpenClaw installation. Update the `RUN npm install -g openclaw` line with the actual installation method once OpenClaw package is available.

### File changes not being tracked
Check that chokidar is watching the correct patterns:
```bash
docker-compose exec winston-tenant-test cat /winston/sidecar.js | grep WATCH_PATTERNS
```

## Next Steps

- [ ] Test with actual OpenClaw installation
- [ ] Deploy to Railway test tenant
- [ ] Implement sync worker to capture file changes to Postgres
- [ ] Build admin dashboard file browser
- [ ] Add file diff/rollback functionality
