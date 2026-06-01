/**
 * lib/qiospay.ts
 * Integrasi Qiospay H2H untuk Top Up Game
 * Dokumentasi: https://qiospay.id/mitra
 */

import crypto from 'crypto';

export interface QiospayConfig {
  memberID: string;   // Username/memberID di Qiospay
  pin: string;        // PIN transaksi
  password: string;   // Password akun Qiospay
  callbackUrl: string; // URL callback dari server kita
}

export interface TopupGameRequest {
  product: string;    // Kode produk Qiospay
  dest: string;       // Nomor tujuan / User ID
  refID: string;      // Referensi unik dari sistem kita
  hargaMax?: number;  // Batas harga max (optional)
}

export interface QiospayResponse {
  success: boolean;
  raw: string;         // Respons mentah dari Qiospay
  refID: string;
  status: 'processing' | 'success' | 'failed' | 'invalid';
  message: string;
}

// ─── Signature Generator ───────────────────────────────────────────────────────
// Formula: encodeBase64(sha1("OtomaX|" + memberID + "|" + product + "|" + dest + "|" + refID + "|" + pin + "|" + password))
export function generateSignature(
  memberID: string,
  product: string,
  dest: string,
  refID: string,
  pin: string,
  password: string
): string {
  const raw = `OtomaX|${memberID}|${product}|${dest}|${refID}|${pin}|${password}`;
  const sha1 = crypto.createHash('sha1').update(raw).digest('hex');
  return Buffer.from(sha1).toString('base64');
}

// ─── Kirim Transaksi Top Up ────────────────────────────────────────────────────
export async function sendTopupTransaction(
  config: QiospayConfig,
  req: TopupGameRequest
): Promise<QiospayResponse> {
  const { memberID, pin, password } = config;
  const { product, dest, refID, hargaMax } = req;

  const sign = generateSignature(memberID, product, dest, refID, pin, password);

  const params = new URLSearchParams({
    product,
    dest,
    refID,
    memberID,
    pin,
    password,
    sign,
  });

  if (hargaMax) {
    params.append('harga_max', String(hargaMax));
  }

  const url = `https://qiospay.id/api/h2h/trx?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(30_000),
    });

    const raw = await res.text();

    return parseQiospayResponse(raw, refID);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      raw: '',
      refID,
      status: 'failed',
      message: `Gagal menghubungi server Qiospay: ${msg}`,
    };
  }
}

// ─── Parse Respons Qiospay ─────────────────────────────────────────────────────
// Contoh respons sukses: "R#test4 sp2 085282756500, Mohon tunggu transaksi sedang diproses. Saldo 15.501.485 @ 08/07/2025 20:45"
// Contoh respons gagal:  "Invalid Signature"
export function parseQiospayResponse(raw: string, refID: string): QiospayResponse {
  const upper = raw.toUpperCase();

  if (upper.includes('INVALID SIGNATURE')) {
    return { success: false, raw, refID, status: 'invalid', message: 'Signature tidak valid' };
  }

  if (upper.includes('DIABAIKAN') || upper.includes('HARGA MAX')) {
    return { success: false, raw, refID, status: 'failed', message: raw };
  }

  if (upper.includes('GAGAL') || upper.includes('FAILED') || upper.includes('ERROR')) {
    return { success: false, raw, refID, status: 'failed', message: raw };
  }

  // Respons dengan "Mohon tunggu" berarti transaksi sedang diproses
  if (upper.includes('MOHON TUNGGU') || upper.includes('DIPROSES') || raw.startsWith('R#')) {
    return {
      success: true,
      raw,
      refID,
      status: 'processing',
      message: 'Transaksi sedang diproses',
    };
  }

  // Jika ada "SUKSES" atau "BERHASIL"
  if (upper.includes('SUKSES') || upper.includes('BERHASIL') || upper.includes('SUCCESS')) {
    return { success: true, raw, refID, status: 'success', message: raw };
  }

  // Default: anggap sedang diproses jika ada R#
  if (raw.includes('R#')) {
    return { success: true, raw, refID, status: 'processing', message: raw };
  }

  return { success: false, raw, refID, status: 'failed', message: raw || 'Respons tidak dikenali' };
}

// ─── Ambil Config dari env ─────────────────────────────────────────────────────
export function getQiospayConfig(): QiospayConfig {
  return {
    memberID: process.env.QIOSPAY_MEMBER_ID || '',
    pin: process.env.QIOSPAY_PIN || '',
    password: process.env.QIOSPAY_PASSWORD || '',
    callbackUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/api/topup-game/callback`,
  };
}

export function validateQiospayConfig(config: QiospayConfig): string | null {
  if (!config.memberID) return 'QIOSPAY_MEMBER_ID belum diatur';
  if (!config.pin) return 'QIOSPAY_PIN belum diatur';
  if (!config.password) return 'QIOSPAY_PASSWORD belum diatur';
  return null;
}
