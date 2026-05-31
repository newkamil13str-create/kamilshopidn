import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ success: false }, { status: 400 });

    const secret = process.env.TURNSTILE_SECRET_KEY || '';
    if (!secret) return NextResponse.json({ success: true }); // Skip if no secret

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ secret, response: token }),
    });

    const data = await res.json();
    return NextResponse.json({ success: data.success === true });
  } catch {
    return NextResponse.json({ success: true }); // Fail open
  }
}
