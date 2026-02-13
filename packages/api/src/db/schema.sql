-- Winston POC Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenant organizations
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  industry VARCHAR(100),
  sub_industry VARCHAR(100),
  website_url VARCHAR(500),
  brand_colors JSONB,
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  selected_model VARCHAR(100) NOT NULL DEFAULT 'kimi-k2.5',
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  credits_remaining DECIMAL(12,2) NOT NULL DEFAULT 50000,
  credits_monthly_allotment DECIMAL(12,2) NOT NULL DEFAULT 50000,
  credits_refresh_date TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tenant instances (Railway containers)
CREATE TABLE IF NOT EXISTS tenant_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_name VARCHAR(255),
  railway_service_id VARCHAR(255),
  railway_domain VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  config_version VARCHAR(20),
  last_health_check TIMESTAMP,
  health_status VARCHAR(50),
  sidecar_url VARCHAR(255),
  sidecar_token VARCHAR(255),
  setup_password VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sidecar file tracking (configs + agent-created content)
CREATE TABLE IF NOT EXISTS file_snapshots (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  hash VARCHAR(64) NOT NULL,
  size INTEGER NOT NULL,
  modified_at TIMESTAMP,
  source VARCHAR(20) NOT NULL CHECK (source IN ('agent', 'admin', 'system')),
  captured_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_snapshots_tenant_file ON file_snapshots(tenant_id, file_path, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_hash ON file_snapshots(hash);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_source ON file_snapshots(source, captured_at);

CREATE TABLE IF NOT EXISTS file_changes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_changes_tenant_recent ON file_changes(tenant_id, changed_at DESC);

-- Credit usage log
CREATE TABLE IF NOT EXISTS credit_usage (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES tenant_instances(id) ON DELETE SET NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  credits_used DECIMAL(10,4) NOT NULL,
  model VARCHAR(100),
  credit_multiplier DECIMAL(4,2),
  channel VARCHAR(50),
  session_id VARCHAR(255)
);

-- Session transcripts (synced from container JSONL)
-- Retention: 90 days default
CREATE TABLE IF NOT EXISTS session_transcripts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES tenant_instances(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  channel VARCHAR(50),
  agent_id VARCHAR(100),
  role VARCHAR(20) NOT NULL,
  content TEXT,
  tool_calls JSONB,
  tokens_used INTEGER,
  timestamp TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '90 days')
);

-- Channel health tracking
CREATE TABLE IF NOT EXISTS channel_health (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES tenant_instances(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL,
  last_message_at TIMESTAMP,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT NOW()
);

-- Connector credentials (reference only - actual keys in Railway sealed vars)
CREATE TABLE IF NOT EXISTS tenant_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  connector_type VARCHAR(100) NOT NULL,
  display_name VARCHAR(255),
  access_level VARCHAR(20) DEFAULT 'read',
  status VARCHAR(50) DEFAULT 'active',
  railway_var_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Backfill/upgrade older schemas safely (schema.sql is allowed to be re-run)
ALTER TABLE tenant_instances ADD COLUMN IF NOT EXISTS railway_domain VARCHAR(255);
ALTER TABLE tenant_instances ADD COLUMN IF NOT EXISTS sidecar_url VARCHAR(255);
ALTER TABLE tenant_instances ADD COLUMN IF NOT EXISTS sidecar_token VARCHAR(255);
ALTER TABLE tenant_instances ADD COLUMN IF NOT EXISTS setup_password VARCHAR(255);

COMMENT ON TABLE file_snapshots IS 'Stores all file versions from tenant containers (configs, SOUL.md, agent-created content, etc.)';
COMMENT ON TABLE file_changes IS 'Tracks file modification events for sync worker efficiency';
COMMENT ON COLUMN file_snapshots.source IS 'Who/what created this file: agent (OpenClaw), admin (Winston dashboard), system (provisioner)';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_usage_tenant_time ON credit_usage(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_tenant_session ON session_transcripts(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_timestamp ON session_transcripts(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_session_transcripts_expires ON session_transcripts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_channel_health_tenant ON channel_health(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_tenant ON tenant_instances(tenant_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tenants table
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Apply updated_at trigger to users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data
-- (None for POC - tenants will be created via API)

COMMENT ON TABLE tenants IS 'Tenant organizations with credit balances and subscription info';
COMMENT ON TABLE tenant_instances IS 'Railway container instances for each tenant';
COMMENT ON TABLE credit_usage IS 'Token consumption audit trail for billing and monitoring';
COMMENT ON TABLE session_transcripts IS 'Conversation history synced from OpenClaw containers';
COMMENT ON COLUMN session_transcripts.expires_at IS 'Auto-cleanup after 90 days for storage management';
