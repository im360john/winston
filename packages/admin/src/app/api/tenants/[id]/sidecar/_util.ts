import { NextResponse } from 'next/server';

const API_URL = process.env.WINSTON_API_URL || 'https://winston-api-production.up.railway.app';

export async function getTenantInstance(tenantId: string) {
  const res = await fetch(`${API_URL}/api/tenants/${tenantId}/instance`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Winston API returned ${res.status} for tenant instance`);
  }
  return res.json() as Promise<{
    railway_domain: string;
    sidecar_token: string;
    setup_password?: string;
  }>;
}

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

