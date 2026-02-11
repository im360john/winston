-- Winston POC Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenant organizations
CREATE TABLE tenants (
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
CREATE TABLE tenant_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_name VARCHAR(255),
  railway_service_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
  config_version VARCHAR(20),
  last_health_check TIMESTAMP,
  health_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Config snapshots for versioning and rollback
CREATE TABLE config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES tenant_instances(id) ON DELETE CASCADE,
  config_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credit usage log
CREATE TABLE credit_usage (
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
CREATE TABLE session_transcripts (
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
CREATE TABLE channel_health (
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
CREATE TABLE tenant_connectors (
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
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_credit_usage_tenant_time ON credit_usage(tenant_id, timestamp DESC);
CREATE INDEX idx_session_transcripts_tenant_session ON session_transcripts(tenant_id, session_id);
CREATE INDEX idx_session_transcripts_timestamp ON session_transcripts(tenant_id, timestamp DESC);
CREATE INDEX idx_session_transcripts_expires ON session_transcripts(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id, timestamp DESC);
CREATE INDEX idx_channel_health_tenant ON channel_health(tenant_id, channel);
CREATE INDEX idx_tenant_instances_tenant ON tenant_instances(tenant_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to tenants table
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initial data
-- (None for POC - tenants will be created via API)

COMMENT ON TABLE tenants IS 'Tenant organizations with credit balances and subscription info';
COMMENT ON TABLE tenant_instances IS 'Railway container instances for each tenant';
COMMENT ON TABLE credit_usage IS 'Token consumption audit trail for billing and monitoring';
COMMENT ON TABLE session_transcripts IS 'Conversation history synced from OpenClaw containers';
COMMENT ON COLUMN session_transcripts.expires_at IS 'Auto-cleanup after 90 days for storage management';
