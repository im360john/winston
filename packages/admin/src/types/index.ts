export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  tier: 'free' | 'starter' | 'growth';
  status: 'active' | 'provisioning' | 'error' | 'inactive';
  created_at: string;
  updated_at: string;
  railway_service_id?: string;
  railway_domain?: string;
  credits_balance?: number;
}

export interface TenantInstance {
  tenant_id: string;
  railway_service_id: string;
  railway_domain: string;
  sidecar_token: string;
  status: string;
  health_status?: string;
  last_health_check?: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  mtime: string;
}

export interface FileContent {
  content: string;
  metadata: {
    path: string;
    size: number;
    mtime: string;
    hash: string;
  };
}

export interface HealthStatus {
  ok: boolean;
  service: string;
  uptime: number;
  tenant_id: string;
  state_dir: string;
}

export interface FileChange {
  timestamp: string;
  file: string;
  action: 'created' | 'modified' | 'deleted';
  source: 'agent' | 'admin';
}

export interface SessionTranscript {
  id: string;
  tenant_id: string;
  tenant_name: string;
  session_id: string;
  channel: string;
  messages_json: string;
  message_count: number;
  credits_used: number;
  created_at: string;
}

export interface CreditUsageRecord {
  id: string;
  tenant_id: string;
  tenant_name: string;
  model: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  created_at: string;
}
