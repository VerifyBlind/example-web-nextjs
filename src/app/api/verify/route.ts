import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createVerifier, type VerifyBlindErrorCode } from '@verifyblind/server';
import store from '@/lib/redis';

// @verifyblind/server needs node:crypto; the Edge runtime is not supported.
export const runtime = 'nodejs';

// Must match the prefix used in /api/generate.
const NONCE_PREFIX = 'popnonce:';

// test.verifyblind.com is a test partner and works with the demo card, so test-card results are
// accepted here. A real site keeps the default (allowTestCards: false).
const verifier = createVerifier({
    apiBaseUrl: process.env.VERIFYBLIND_API_URL || 'https://api.verifyblind.com',
    allowTestCards: true,
});

const ERRORS: Partial<Record<VerifyBlindErrorCode, { status: number; message: string }>> = {
    BAD_TOKEN: { status: 400, message: 'Geçersiz token' },
    BAD_SIGNATURE: { status: 401, message: 'Geçersiz imza' },
    KEY_FETCH_FAILED: { status: 503, message: 'Enclave public key alınamadı' },
    BAD_PAYLOAD: { status: 400, message: 'Geçersiz oturum (nonce yok)' },
    NONCE_NOT_FOUND: { status: 401, message: 'Oturum süresi dolmuş veya zaten kullanılmış' },
    ASKED_MISMATCH: { status: 401, message: 'Sonuç sorulan doğrulamalarla eşleşmiyor' },
    TEST_CARD: { status: 403, message: 'Demo kart sonucu kabul edilmiyor' },
};

/**
 * POST /api/verify
 * @verifyblind/server checks the enclave signature (RSA-PSS SHA-256), consumes the nonce exactly once
 * and reads the result against the validations /api/generate stored with that nonce (never against
 * what the browser says it asked).
 * Returns { success: true, data: signedPayload, asked } or { error }.
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        if (typeof token !== 'string' || !token) {
            return NextResponse.json({ error: 'token gerekli' }, { status: 400 });
        }

        const r = await verifier.verifyAndConsume(token, (nonce) => store.getdel(`${NONCE_PREFIX}${nonce}`));
        if (!r.ok) {
            const e = ERRORS[r.error.code] ?? { status: 401, message: 'Doğrulama başarısız' };
            // Only the error code: the library keeps identity codes out of it.
            console.warn(`[TestPortal Verify] ❌ ${r.error.code}`);
            return NextResponse.json({ error: e.message, code: r.error.code }, { status: e.status });
        }

        // Kimlik kodları (user_id, nsbd_id, doc_id) log'a YAZILMAZ.
        console.log('[TestPortal Verify] ✅ İmza doğrulandı');
        return NextResponse.json({ success: true, data: r.payload, asked: r.asked });

    } catch (error: any) {
        Sentry.captureException(error);
        console.error('[TestPortal Verify] Hata:', error?.message);
        return NextResponse.json({ error: error?.message || 'Sunucu hatası' }, { status: 500 });
    }
}
