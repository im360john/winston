#!/bin/bash
# Test script for Winston sidecar API
# Run this to test the sidecar locally before deploying to Railway

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Winston Sidecar API Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Configuration
SIDECAR_URL="${SIDECAR_URL:-http://localhost:18790}"
TOKEN="${WINSTON_SIDECAR_TOKEN:-test-token-123}"

echo "📡 Sidecar URL: $SIDECAR_URL"
echo "🔑 Token: ${TOKEN:0:10}..."
echo ""

# Helper function for API calls
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="$3"

  echo "➜ $method $endpoint"

  if [ -z "$data" ]; then
    curl -s -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      "$SIDECAR_URL$endpoint" | jq '.' || echo "(no JSON response)"
  else
    curl -s -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$SIDECAR_URL$endpoint" | jq '.' || echo "(no JSON response)"
  fi

  echo ""
}

# Test 1: Health check
echo "━━━ Test 1: Health Check ━━━"
api_call GET /health

# Test 2: List root directory
echo "━━━ Test 2: List Files ━━━"
api_call GET /files

# Test 3: Create a test file
echo "━━━ Test 3: Write File ━━━"
api_call PUT /files/test-soul.md '{
  "content": "# Test Soul\n\nThis is a test SOUL.md file created via sidecar API.\n\n## Personality\nFriendly and helpful."
}'

# Test 4: Read the file back
echo "━━━ Test 4: Read File ━━━"
api_call GET /files/test-soul.md

# Test 5: Update the file
echo "━━━ Test 5: Update File ━━━"
api_call PUT /files/test-soul.md '{
  "content": "# Updated Test Soul\n\nThis file has been updated!\n\n## Personality\nVery friendly and extremely helpful."
}'

# Test 6: List files again
echo "━━━ Test 6: List Files (after changes) ━━━"
api_call GET /files

# Test 7: View change log
echo "━━━ Test 7: View Changes ━━━"
api_call GET /changes?limit=10

# Test 8: Create nested file
echo "━━━ Test 8: Create Nested File (skill) ━━━"
api_call PUT /files/skills/test-skill/SKILL.md '{
  "content": "# Test Skill\n\nA test skill created via API.\n\n## Purpose\nDemonstrate nested file creation."
}'

# Test 9: List skills directory
echo "━━━ Test 9: List Skills Directory ━━━"
api_call GET '/files?path=skills'

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test complete!"
echo ""
echo "To clean up test files:"
echo "  rm -rf /data/test-soul.md /data/skills/test-skill"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
