/**
 * app/api/check-game-id/route.ts
 *
 * Validasi User ID game dan ambil nickname sebelum checkout.
 * Mendukung: Free Fire, Mobile Legends
 *
 * GET /api/check-game-id?game=free-fire&userId=123456789
 * GET /api/check-game-id?game=mobile-legends&userId=123456789&zoneId=1234
 */

import { NextRequest, NextResponse } from 'next/server';

// Rate limit sederhana
const rateMap = new Map<string, { count: number; resetAt: number }>();
function checkRate(ip: string) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now > e.resetAt) { rateMap.set(ip, { count: 1, resetAt: now + 60_000 }); return true; }
  if (e.count >= 20) return false;
  e.count++;
  return true;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRate(ip)) {
    return NextResponse.json({ error: 'Terlalu banyak permintaan.' }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const game   = searchParams.get('game');
  const userId = searchParams.get('userId')?.trim();
  const zoneId = searchParams.get('zoneId')?.trim();

  if (!game || !userId) {
    return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
  }

  try {
    switch (game) {
      case 'free-fire':
        return await checkFreeFire(userId);
      case 'mobile-legends':
      case 'mobile-legends-malaysia':
        if (!zoneId) return NextResponse.json({ error: 'Zone ID diperlukan untuk Mobile Legends.' }, { status: 400 });
        return await checkMobileLegends(userId, zoneId);
      default:
        // Game lain tidak support cek nickname
        return NextResponse.json({ supported: false });
    }
  } catch (err) {
    console.error('[check-game-id]', err);
    return NextResponse.json({ error: 'Gagal memvalidasi akun. Coba lagi.' }, { status: 500 });
  }
}

// ─── Free Fire ────────────────────────────────────────────────────────────────
async function checkFreeFire(userId: string) {
  const res = await fetch('https://shop2game.com/api/auth/player_id_login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      app_id: 100067,
      login_id: userId,
      guest_login: false,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Gagal menghubungi server Free Fire.' }, { status: 502 });
  }

  const data = await res.json();

  if (!data?.username) {
    return NextResponse.json({ valid: false, error: 'User ID Free Fire tidak ditemukan.' });
  }

  return NextResponse.json({
    valid: true,
    supported: true,
    username: data.username,
    userId,
  });
}

// ─── Mobile Legends ───────────────────────────────────────────────────────────
async function checkMobileLegends(userId: string, zoneId: string) {
  const res = await fetch('https://order.mobilelegends.com/order/checkRoleId', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      productId: '1',
      roleId: userId,
      zoneId,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Gagal menghubungi server Mobile Legends.' }, { status: 502 });
  }

  const data = await res.json();

  // ML return code 0 = success
  if (data?.code !== 0 || !data?.roleName) {
    return NextResponse.json({ valid: false, error: 'User ID / Zone ID Mobile Legends tidak ditemukan.' });
  }

  return NextResponse.json({
    valid: true,
    supported: true,
    username: data.roleName,
    userId,
    zoneId,
  });
}
