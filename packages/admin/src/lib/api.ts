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
  return response.data;
}

export async function getTenant(id: string): Promise<Tenant> {
  const response = await api.get(`/tenants/${id}`);
  return response.data;
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
  private baseUrl: string;
  private token: string;

  constructor(domain: string, token: string) {
    this.baseUrl = `https://${domain}`;
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async health(): Promise<HealthStatus> {
    const response = await axios.get(`${this.baseUrl}/winston/health`);
    return response.data;
  }

  async listFiles(path: string = ''): Promise<FileEntry[]> {
    const response = await axios.get(
      `${this.baseUrl}/winston/files/${path}`,
      { headers: this.headers }
    );
    return response.data.files || [];
  }

  async readFile(path: string): Promise<FileContent> {
    const response = await axios.get(
      `${this.baseUrl}/winston/files/${path}`,
      { headers: this.headers }
    );
    return response.data;
  }

  async writeFile(path: string, content: string): Promise<{ success: boolean; path: string; size: number; hash: string }> {
    const response = await axios.put(
      `${this.baseUrl}/winston/files/${path}`,
      { content },
      { headers: this.headers }
    );
    return response.data;
  }

  async getChanges(): Promise<FileChange[]> {
    const response = await axios.get(
      `${this.baseUrl}/winston/changes`,
      { headers: this.headers }
    );
    return response.data.changes || [];
  }
}

// ============================================================================
// Setup API Client (for gateway control)
// ============================================================================

export class SetupClient {
  private baseUrl: string;
  private password: string;

  constructor(domain: string, password: string) {
    this.baseUrl = `https://${domain}`;
    this.password = password;
  }

  private get auth() {
    return {
      username: '',
      password: this.password,
    };
  }

  async getStatus() {
    const response = await axios.get(
      `${this.baseUrl}/setup/api/status`,
      { auth: this.auth }
    );
    return response.data;
  }

  async restartGateway() {
    const response = await axios.post(
      `${this.baseUrl}/setup/api/console/run`,
      { cmd: 'gateway.restart' },
      { auth: this.auth }
    );
    return response.data;
  }

  async getHealth() {
    const response = await axios.get(`${this.baseUrl}/healthz`);
    return response.data;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export async function getSidecarClient(tenantId: string): Promise<SidecarClient> {
  const instance = await getTenantInstance(tenantId);
  if (!instance.railway_domain) {
    throw new Error('Tenant instance has no domain');
  }
  return new SidecarClient(instance.railway_domain, instance.sidecar_token);
}

export async function getSetupClient(tenantId: string): Promise<SetupClient> {
  const instance = await getTenantInstance(tenantId);
  if (!instance.railway_domain) {
    throw new Error('Tenant instance has no domain');
  }
  // TODO: Get SETUP_PASSWORD from Railway variables
  // For now, hardcode or fetch from API
  const setupPassword = '624cf97363d7ae56'; // This should come from Railway API
  return new SetupClient(instance.railway_domain, setupPassword);
}
