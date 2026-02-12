#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Winston Tenant Container Starting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Validate required environment variables
if [ -z "$WINSTON_TENANT_ID" ]; then
  echo "❌ ERROR: WINSTON_TENANT_ID environment variable is required"
  exit 1
fi

if [ -z "$WINSTON_SIDECAR_TOKEN" ]; then
  echo "⚠️  WARNING: WINSTON_SIDECAR_TOKEN not set - sidecar API will be unsecured"
fi

echo "🆔 Tenant ID: $WINSTON_TENANT_ID"
echo "📁 Data directory: /data"
echo ""

# Create necessary directories
mkdir -p /data/.winston
mkdir -p /data/skills
mkdir -p /data/workspace

# Start Winston sidecar API in background
echo "🔧 Starting Winston sidecar API..."
cd /winston
node sidecar.js &
SIDECAR_PID=$!

# Give sidecar a moment to initialize
sleep 2

# Check if sidecar started successfully
if ! kill -0 $SIDECAR_PID 2>/dev/null; then
  echo "❌ ERROR: Sidecar failed to start"
  exit 1
fi

echo "✅ Sidecar API running (PID: $SIDECAR_PID)"
echo ""

# Check if initial configs exist, if not create placeholders
# (In production, these should be fetched from Winston API or set via env vars)
if [ ! -f /data/openclaw.json ]; then
  echo "⚠️  No openclaw.json found, creating placeholder..."
  cat > /data/openclaw.json <<EOF
{
  "meta": {
    "lastTouchedVersion": "2026.2.x",
    "winston": {
      "tenantId": "$WINSTON_TENANT_ID",
      "initialized": false
    }
  },
  "gateway": {
    "port": 18789,
    "mode": "local"
  }
}
EOF
fi

if [ ! -f /data/SOUL.md ]; then
  echo "⚠️  No SOUL.md found, creating placeholder..."
  cat > /data/SOUL.md <<'EOF'
# Agent Soul

This agent has not been configured yet.
Please use the Winston admin dashboard to set up this agent's personality.
EOF
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🤖 Starting OpenClaw Gateway..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start OpenClaw (vanilla, unmodified)
# NOTE: This command needs to be updated based on actual OpenClaw installation
# For now, using a placeholder that will keep the container running for testing

if command -v openclaw >/dev/null 2>&1; then
  exec openclaw gateway --config /data/openclaw.json
else
  echo "⚠️  OpenClaw not installed - running in test mode"
  echo "   Sidecar API is available for testing at port 18790"
  echo ""
  echo "   To test the sidecar:"
  echo "   curl -H 'Authorization: Bearer \$WINSTON_SIDECAR_TOKEN' http://localhost:18790/health"
  echo ""

  # Keep container running for testing
  tail -f /dev/null
fi
