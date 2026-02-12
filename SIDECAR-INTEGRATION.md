# Sidecar Integration with Existing Provisioner

## What We Changed

Modified the existing `railway-provisioner.js` to add sidecar support with **minimal changes**:

### Changes Made

1. **Added sidecar token generation** (line ~335)
   ```javascript
   const sidecarToken = crypto.randomBytes(32).toString('hex');
   WINSTON_SIDECAR_TOKEN: sidecarToken
   ```

2. **Added file_snapshots save function** (before provisionToRailway)
   - Saves all generated configs (SOUL.md, openclaw.json, etc.) to database
   - Enables sidecar to sync/read these files

3. **Enhanced return value** (line ~78)
   ```javascript
   return {
     ...existing,
     sidecarUrl: `${url}:18790`,
     sidecarToken: configs.sidecarToken
   }
   ```

## Current State

✅ **Working:**
- Railway provisioner creates services
- Sets environment variables (including WINSTON_SIDECAR_TOKEN)
- Creates volumes
- Saves configs to file_snapshots table
- Returns sidecar URL and token

⚠️ **Remaining Issue:**
- Currently deploys from: `vignesh07/clawdbot-railway-template`
- This template does NOT have our sidecar code (sidecar.js, entrypoint.sh)

## Next Steps

### Option 1: Update GitHub Template (Recommended)

1. Fork or update the Railway template to include sidecar:
   ```
   clawdbot-railway-template/
   ├── Dockerfile  (our sidecar Dockerfile)
   ├── sidecar.js
   ├── entrypoint.sh
   ├── package.json
   └── ...
   ```

2. Update line 210 in railway-provisioner.js:
   ```javascript
   source: {
     repo: "YOUR_GITHUB_USER/winston-openclaw-sidecar"
   }
   ```

### Option 2: Keep Separate

- Deploy standard OpenClaw from existing template
- Add sidecar as a separate service in the same project
- Link them via shared volume

### Option 3: Manual Deployment (Current Workaround)

1. Use existing provisioner (provisions everything except sidecar)
2. Manually deploy sidecar using `railway up` from docker/openclaw-tenant/

## Testing

Run the test script:
```bash
node test-modified-provisioner.js
```

This will:
- Create a tenant
- Generate configs
- Provision to Railway
- Save configs to file_snapshots
- Return sidecar credentials

## Files Created

- `docker/openclaw-tenant/` - Sidecar Docker image
  - Dockerfile
  - sidecar.js (HTTP API for file management)
  - entrypoint.sh (starts OpenClaw + sidecar)
  - package.json

- `packages/api/src/services/railway-provisioner.js` - Modified ✅
  - Added WINSTON_SIDECAR_TOKEN
  - Added saveConfigsToFileSnapshots()
  - Returns sidecar URL and token

- Database schema updated ✅
  - `file_snapshots` table
  - `file_changes` table
  - `tenant_instances.sidecar_url` column

## Summary

The existing provisioner now has sidecar support built in. The only remaining step is pointing it to a GitHub repo that contains our sidecar Dockerfile, or deploying the sidecar manually after the initial provision.

**Recommendation:** Create a GitHub repo with the docker/openclaw-tenant contents and update the source repo in createService().
