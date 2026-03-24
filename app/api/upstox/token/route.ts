// app/api/upstox/token/route.ts
// What this does: Receives the OAuth code from the callback page and
// forwards it to the backend to exchange for a real Upstox access token.

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

export async function POST(req: NextRequest) {
  try {
    const { code, state } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Forward to Express backend which does the actual token exchange + file save
    const response = await fetch(`${BACKEND_URL}/api/upstox/exchange-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(result, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[/api/upstox/token] Error:', error);
    return NextResponse.json(
      { error: 'Token exchange failed. Is the backend running on port 5002?' },
      { status: 500 }
    );
  }
}
