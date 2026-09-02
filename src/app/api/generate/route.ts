import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import store from '@/lib/redis';

// PoP login replay protection: bind the session nonce at generate, consume once at verify.
// Demo store is in-memory (single-instance only) — use Redis/DB in production.
const NONCE_PREFIX = 'popnonce:';
// MUST cover the full QR scan window. The relay keeps a QR nonce valid for ~15 min, and the Web SDK
// keeps it scannable that long (14-min poll window + auto-regeneration + 1-min grace-poll). A TTL
// shorter than the QR lifetime rejects late-but-valid scans at verify with 401 "Oturum süresi dolmuş".
const NONCE_TTL = 960; // 16 min = relay QR lifetime (900s) + 60s verify round-trip buffer

/**
 * POST /api/verifyblind/generate (proxy)
 * Tarayıcıdan gelen { public_key, validations } isteğini X-API-Key ekleyerek
 * VerifyBlind API'ye iletir. Tarayıcıda credential görünmez.
 */
export async function POST(req: NextRequest) {
    try {
        const apiKey = process.env.TEST_VERIFYBLIND_API_KEY;
        const apiUrl = process.env.VERIFYBLIND_API_URL || 'https://api.verifyblind.com';

        if (!apiKey) {
            return NextResponse.json(
                { error: 'TEST_VERIFYBLIND_API_KEY yapılandırılmamış' },
                { status: 500 }
            );
        }

        const body = await req.json();

        const response = await fetch(`${apiUrl}/api/pop/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                // Forward the browser's language so VerifyBlind localizes errors (tr/en).
                'Accept-Language': req.headers.get('accept-language') || 'tr'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(
                { error: (data as any).error || `API hatası: ${response.status}` },
                { status: response.status }
            );
        }

        // Remember the nonce so /api/verify can bind & one-time-consume it (replay protection).
        if (typeof data.nonce === 'string' && data.nonce) {
            await store.set(`${NONCE_PREFIX}${data.nonce}`, '1', 'EX', NONCE_TTL);
        }

        console.log(`[TestPortal Generate] ✅ Nonce üretildi: ${data.nonce}`);
        return NextResponse.json(data); // { nonce }

    } catch (error: any) {
        Sentry.captureException(error);
        console.error('[TestPortal Generate] Hata:', error);
        return NextResponse.json(
            { error: error?.message || 'Sunucu hatası' },
            { status: 500 }
        );
    }
}
