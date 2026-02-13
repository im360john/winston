import { NextRequest, NextResponse } from 'next/server';
import { getTenantInstance, jsonError } from '../../_util';

export const dynamic = 'force-dynamic';

function joinPath(parts?: string[]) {
  if (!parts || parts.length === 0) return '';
  return parts.map(p => String(p || '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

export async function GET(request: NextRequest, { params }: { params: { id: string; path?: string[] } }) {
  try {
    const inst = await getTenantInstance(params.id);
    if (!inst.railway_domain || !inst.sidecar_token) {
      return jsonError('Tenant instance missing railway_domain or sidecar_token', 400);
    }

    const rel = joinPath(params.path);
    // Sidecar expects `/winston/files/` with an optional trailing path.
    const url = rel
      ? `https://${inst.railway_domain}/winston/files/${encodeURI(rel)}`
      : `https://${inst.railway_domain}/winston/files/`;

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { 'Authorization': `Bearer ${inst.sidecar_token}` },
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to fetch sidecar file');
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string; path?: string[] } }) {
  try {
    const inst = await getTenantInstance(params.id);
    if (!inst.railway_domain || !inst.sidecar_token) {
      return jsonError('Tenant instance missing railway_domain or sidecar_token', 400);
    }

    const rel = joinPath(params.path);
    if (!rel) return jsonError('Missing file path', 400);

    const body = await request.json().catch(() => null) as { content?: string } | null;
    if (!body || typeof body.content !== 'string') return jsonError('Missing content', 400);

    const url = `https://${inst.railway_domain}/winston/files/${encodeURI(rel)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${inst.sidecar_token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: body.content }),
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (e: any) {
    return jsonError(e?.message || 'Failed to write sidecar file');
  }
}
