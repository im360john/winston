export interface Tenant {
  id: string;
  name: string;
  email: string;
  tier: 'free' | 'starter' | 'growth';
  status: 'active' | 'provisioning' | 'error' | 'inactive';
  industry?: string | null;
  sub_industry?: string | null;
  selected_model?: string;
  created_at: string;
  updated_at: string;
  credits_remaining?: string;
  credits_monthly_allotment?: string;
}

export interface TenantInstance {
  tenant_id: string;
  railway_service_id: string;
  railway_domain: string;
  sidecar_token: string;
  setup_password?: string;
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
  message_count?: number;
  credits_used?: number;
  role?: string;
  content?: string;
  timestamp?: string;
}

export interface CreditUsageRecord {
  id: string;
  tenant_id: string;
  tenant_name: string;
  model: string;
  credits_used: number;
  tokens_input: number;
  tokens_output: number;
  timestamp?: string;
}
