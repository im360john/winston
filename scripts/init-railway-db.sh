#!/bin/bash
# Initialize Railway PostgreSQL Database
# Usage: ./scripts/init-railway-db.sh <DATABASE_URL>

if [ -z "$1" ]; then
  echo "Usage: $0 <DATABASE_URL>"
  echo ""
  echo "Get DATABASE_URL from Railway dashboard:"
  echo "  1. Go to PostgreSQL service"
  echo "  2. Click 'Connect' tab"
  echo "  3. Copy the connection URL"
  echo ""
  echo "Example:"
  echo "  $0 'postgresql://postgres:password@host:5432/railway'"
  exit 1
fi

DATABASE_URL="$1"

echo "📦 Initializing Winston Database on Railway"
echo "============================================"
echo ""

# Run schema migration
echo "📋 Running schema migration..."
psql "$DATABASE_URL" < packages/api/src/db/schema.sql

if [ $? -ne 0 ]; then
  echo "❌ Schema migration failed"
  exit 1
fi

echo "✅ Schema created successfully"
echo ""

# Create system tenant
echo "👤 Creating system tenant..."
psql "$DATABASE_URL" << 'EOF'
INSERT INTO tenants (
  id,
  name,
  email,
  tier,
  status,
  selected_model,
  credits_balance,
  credits_limit,
  credits_refresh_date
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System Tenant',
  'system@winston.internal',
  'unlimited',
  'active',
  'claude-sonnet-4-5',
  999999999,
  999999999,
  NOW() + INTERVAL '100 years'
)
ON CONFLICT (id) DO NOTHING;
EOF

if [ $? -ne 0 ]; then
  echo "❌ System tenant creation failed"
  exit 1
fi

echo "✅ System tenant created"
echo ""
echo "🎉 Database initialization complete!"
echo ""
echo "Now verify the deployment:"
echo "  curl https://winston-api-production.up.railway.app/api/health"
