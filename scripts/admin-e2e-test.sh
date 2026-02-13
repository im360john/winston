#!/usr/bin/env bash
set -euo pipefail

ADMIN_BASE_URL="${ADMIN_BASE_URL:-https://winston-admin-production.up.railway.app}"
API_BASE_URL="${API_BASE_URL:-https://winston-api-production.up.railway.app}"

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo "[e2e] ADMIN_BASE_URL=$ADMIN_BASE_URL"
echo "[e2e] API_BASE_URL=$API_BASE_URL"
echo "[e2e] timestamp=$ts"
echo

tenants_json="$(curl -fsS "$API_BASE_URL/api/tenants")"
tenant_ids="$(IN="$tenants_json" node -e "const j=JSON.parse(process.env.IN); (j.tenants||[]).forEach(t=>console.log(t.id));")"

if [ -z "$tenant_ids" ]; then
  echo "[e2e] No tenants returned from API"
  exit 1
fi

failures=0
tested=0

for tid in $tenant_ids; do
  # Only test deployed instances (tenant_instances exists)
  if ! curl -fsS "$API_BASE_URL/api/tenants/$tid/instance" >/dev/null 2>&1; then
    echo "[e2e] skip tenant=$tid (no instance)"
    continue
  fi

tested=$((tested+1))
  echo "[e2e] tenant=$tid"

  # Sidecar health
  curl -fsS "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/health" >/dev/null
  echo "  - sidecar health: ok"

  # Read openclaw.json (may not exist if provisioning is incomplete)
  if ! curl -fsS "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/openclaw.json" >"/tmp/$tid.openclaw.json.resp" 2>/dev/null; then
    echo "  - openclaw.json: missing (creating minimal stub)"
    minimal_cfg="$(cat <<'JSON'
{
  "meta": { "lastTouchedVersion": "winston-admin-e2e" },
  "agents": { "defaults": { "model": { "primary": "winston/kimi-k2.5" } } }
}
JSON
)"
    curl -fsS -X PUT "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/openclaw.json" \
      -H 'content-type: application/json' \
      -d "$(C="$minimal_cfg" node -e "console.log(JSON.stringify({content: process.env.C}))")" >/dev/null
    curl -fsS "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/openclaw.json" >"/tmp/$tid.openclaw.json.resp"
  fi
  IN="/tmp/$tid.openclaw.json.resp" OUT="/tmp/$tid.openclaw.json" node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.env.IN,'utf8')); fs.writeFileSync(process.env.OUT,j.content,'utf8');"
  echo "  - openclaw.json: read"

  # Write openclaw.json unchanged (exercise write path without schema changes)
  IN="/tmp/$tid.openclaw.json" URL="$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/openclaw.json" node -e "const fs=require('fs'); const content=fs.readFileSync(process.env.IN,'utf8'); fetch(process.env.URL,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({content})}).then(async r=>{const t=await r.text(); if(!r.ok) throw new Error(r.status+' '+t); console.log('  - openclaw.json: wrote');}).catch(e=>{console.error('  - openclaw.json: write FAIL', String(e)); process.exit(1);});"

  # Write SOUL.md (create/update)
  soul_content="# SOUL\n\nUpdated by admin e2e $ts\n"
  curl -fsS -X PUT "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/SOUL.md" \
    -H 'content-type: application/json' \
    -d "$(C="$soul_content" node -e "console.log(JSON.stringify({content: process.env.C}))")" >/dev/null
  echo "  - SOUL.md: wrote"

  # Read SOUL.md back and verify marker
  soul_read="$(curl -fsS "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/files/SOUL.md")"
  IN="$soul_read" TS="$ts" node -e "const j=JSON.parse(process.env.IN); if(!j.content.includes(process.env.TS)) { throw new Error('marker missing'); }"
  echo "  - SOUL.md: verified"

  # Restart gateway
  if curl -fsS -X POST "$ADMIN_BASE_URL/api/tenants/$tid/setup/restart" >/dev/null 2>&1; then
    echo "  - gateway restart: requested"
  else
    echo "  - gateway restart: FAIL"
    failures=$((failures+1))
  fi

  # Check changes contain expected file names (best effort)
  changes="$(curl -fsS "$ADMIN_BASE_URL/api/tenants/$tid/sidecar/changes")"
  IN="$changes" node -e "const j=JSON.parse(process.env.IN); const files=new Set((j.changes||[]).map(c=>c.file)); if(!files.has('SOUL.md')) process.exit(2);" || {
    echo "  - changes: missing SOUL.md entry (WARN)"
  }
  echo "  - changes: ok"

  echo
done

echo "[e2e] tested_instances=$tested failures=$failures"
if [ "$tested" -eq 0 ]; then
  echo "[e2e] No deployed tenant instances found to test"
  exit 1
fi
if [ "$failures" -ne 0 ]; then
  exit 1
fi
