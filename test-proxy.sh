#!/bin/bash
# Test LLM Proxy with Kimi K2.5

TENANT_ID="53eb6054-4c8d-442c-a9c7-9ce7970b9376"

echo "Testing Winston LLM Proxy..."
echo "Tenant ID: $TENANT_ID"
echo ""

curl -X POST http://localhost:3002/v1/messages \
  -H "Authorization: Bearer winston-$TENANT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Say hello in exactly 5 words."
      }
    ],
    "max_tokens": 50
  }' | jq .

echo ""
echo "Checking credits used..."
psql -U winston -d winston -h localhost -c "SELECT credits_remaining, credits_monthly_allotment FROM tenants WHERE id = '$TENANT_ID';"
