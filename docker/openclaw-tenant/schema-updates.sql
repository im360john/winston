-- Winston Sidecar File Management Schema
-- Replaces config_snapshots with more comprehensive file tracking

-- Drop old config_snapshots table (if migrating)
-- DROP TABLE IF EXISTS config_snapshots;

-- Track all file snapshots with full history
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

-- Track file changes for efficient sync
CREATE TABLE IF NOT EXISTS file_changes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_changes_tenant_recent ON file_changes(tenant_id, changed_at DESC);

-- Update tenant_instances to include sidecar URL
ALTER TABLE tenant_instances
ADD COLUMN IF NOT EXISTS sidecar_url VARCHAR(255);

-- Add comment for clarity
COMMENT ON TABLE file_snapshots IS 'Stores all file versions from tenant containers (configs, SOUL.md, agent-created skills, etc.)';
COMMENT ON TABLE file_changes IS 'Tracks file modification events for sync worker efficiency';
COMMENT ON COLUMN file_snapshots.source IS 'Who/what created this file: agent (OpenClaw), admin (Winston dashboard), system (provisioner)';
