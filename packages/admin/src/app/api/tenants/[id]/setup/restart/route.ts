import { NextRequest, NextResponse } from 'next/server';
import { basicAuthHeader, getTenantInstance, jsonError } from '../_util';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const inst = await getTenantInstance(params.id);
    if (!inst.railway_domain || !inst.setup_password) {
      return jsonError('Tenant instance missing railway_domain or setup_password', 400);
    }

    const res = await fetch(`https://${inst.railway_domain}/setup/api/console/run`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuthHeader(inst.setup_password),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ cmd: 'gateway.restart' }),
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to restart gateway');
  }
}
