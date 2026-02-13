import { NextRequest, NextResponse } from 'next/server';
import { getTenantInstance, jsonError } from '../_util';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const inst = await getTenantInstance(params.id);
    if (!inst.railway_domain) {
      return jsonError('Tenant instance missing railway_domain', 400);
    }

    const res = await fetch(`https://${inst.railway_domain}/healthz`, { cache: 'no-store' });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to fetch tenant healthz');
  }
}
