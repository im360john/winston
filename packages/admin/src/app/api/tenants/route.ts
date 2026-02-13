import { NextResponse } from 'next/server';

const API_URL = process.env.WINSTON_API_URL || 'https://winston-api-production.up.railway.app';

// This endpoint must always be live (no static caching), otherwise newly provisioned tenants
// won't appear in the admin UI until a redeploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/tenants`, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}
