import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.WINSTON_API_URL || 'http://localhost:3001';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const response = await fetch(`${API_URL}/api/tenants/${params.id}/instance`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching tenant instance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant instance' },
      { status: 500 }
    );
  }
}
