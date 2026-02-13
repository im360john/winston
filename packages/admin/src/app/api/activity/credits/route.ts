import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.WINSTON_API_URL || 'https://winston-api-production.up.railway.app';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';

    const response = await fetch(`${API_URL}/api/activity/credits?days=${days}`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}
