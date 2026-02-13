-- Add missing fields to tenant_instances table for admin dashboard
ALTER TABLE tenant_instances
  ADD COLUMN IF NOT EXISTS railway_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sidecar_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS setup_password VARCHAR(255);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenant_instances_tenant_id ON tenant_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_instances_railway_service_id ON tenant_instances(railway_service_id);
