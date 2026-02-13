import axios from 'axios';
import { Tenant, TenantInstance, FileEntry, FileContent, HealthStatus, FileChange, SessionTranscript, CreditUsageRecord } from '@/types';

const api = axios.create({
  baseURL: '/api',
});

// ============================================================================
// Tenant Management
// ============================================================================

export async function getTenants(): Promise<Tenant[]> {
  const response = await api.get('/tenants');
  // Winston API returns { tenants: [...], count: n }
  return response.data.tenants || [];
}

export async function getTenant(id: string): Promise<Tenant> {
  const response = await api.get(`/tenants/${id}`);
  // Winston API returns { tenant: {...} }
  return response.data.tenant;
}

export async function getTenantInstance(tenantId: string): Promise<TenantInstance> {
  const response = await api.get(`/tenants/${tenantId}/instance`);
  return response.data;
}

export async function getSessionTranscripts(limit = 100): Promise<SessionTranscript[]> {
  const response = await api.get('/activity/transcripts', { params: { limit } });
  return response.data;
}

export async function getCreditUsage(days = 30): Promise<CreditUsageRecord[]> {
  const response = await api.get('/activity/credits', { params: { days } });
  return response.data;
}

// ============================================================================
// Sidecar API Client
// ============================================================================

export class SidecarClient {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async health(): Promise<HealthStatus> {
    const response = await api.get(`/tenants/${this.tenantId}/sidecar/health`);
    // Normalize to the UI's expected shape.
    const data = response.data;
    return {
      ok: data.status === 'ok' || data.ok === true,
      service: data.service || 'winston-sidecar',
      uptime: data.uptime,
      tenant_id: data.tenant_id,
      state_dir: data.state_dir,
    };
  }

  async listFiles(path: string = ''): Promise<FileEntry[]> {
    const safePath = path ? `/${path}` : '';
    const response = await api.get(`/tenants/${this.tenantId}/sidecar/files${safePath}`);
    return response.data.files || [];
  }

  async readFile(path: string): Promise<FileContent> {
    const response = await api.get(`/tenants/${this.tenantId}/sidecar/files/${path}`);
    return response.data;
  }

  async writeFile(path: string, content: string): Promise<{ success: boolean; path: string; size: number; hash: string }> {
    const response = await api.put(`/tenants/${this.tenantId}/sidecar/files/${path}`, { content });
    return response.data;
  }

  async getChanges(): Promise<FileChange[]> {
    const response = await api.get(`/tenants/${this.tenantId}/sidecar/changes`);
    return response.data.changes || [];
  }
}

// ============================================================================
// Setup API Client (for gateway control)
// ============================================================================

export class SetupClient {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async getStatus() {
    const response = await api.get(`/tenants/${this.tenantId}/setup/status`);
    return response.data;
  }

  async restartGateway() {
    const response = await api.post(`/tenants/${this.tenantId}/setup/restart`, {});
    return response.data;
  }

  async getHealth() {
    const response = await api.get(`/tenants/${this.tenantId}/setup/healthz`);
    return response.data;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export async function getSidecarClient(tenantId: string): Promise<SidecarClient> {
  // Sidecar operations are proxied through this admin app to avoid CORS + token leakage.
  return new SidecarClient(tenantId);
}

export async function getSetupClient(tenantId: string): Promise<SetupClient> {
  return new SetupClient(tenantId);
}
