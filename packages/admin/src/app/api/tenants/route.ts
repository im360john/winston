import { NextResponse } from 'next/server';

const API_URL = process.env.WINSTON_API_URL || 'https://winston-api-production.up.railway.app';

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/api/tenants`);

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
