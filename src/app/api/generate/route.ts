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

// ── What to ask is decided by the SERVER ─────────────────────────────────────────────
// The enclave signs `validations.age: true|false`, i.e. the answer to the condition it was ASKED.
// The browser body can be edited in DevTools: if this proxy forwarded the browser's `validations`,
// a visitor could ask "1+" instead of "18+" and receive a genuinely signed `age: true`.
//
// A REAL SITE sets validations from its own server configuration and ignores the browser's, e.g.:
//     const VALIDATIONS = { age: '18+', user_id: true };
//
// This demo lets the visitor tick what to verify, so it accepts the browser's choice ONLY from the
// allow-list below. Whatever was asked is stored with the nonce; /api/verify reads the signed
// result against that STORED condition, never against what the browser claims.
const ALLOWED_AGE_CONDITIONS = new Set(['18+']);

type AskedValidations = { age?: string; user_id?: true };

/** Returns the allow-listed validations, or null when the browser asked for anything else. */
function pickValidations(raw: unknown): AskedValidations | null {
    const out: AskedValidations = {};
    if (raw === undefined || raw === null) return out;
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (key === 'age' && typeof value === 'string' && ALLOWED_AGE_CONDITIONS.has(value)) out.age = value;
        else if (key === 'user_id' && value === true) out.user_id = true;
        else return null;
    }
    return out;
}

/**
 * POST /api/verifyblind/generate (proxy)
 * Tarayıcıdan public_key / cf_token / sdk_version / additional_data alır; validations'ı SUNUCU
 * belirler (bu demoda izin listesinden). X-API-Key ekleyerek VerifyBlind API'ye iletir.
 * Tarayıcıda credential görünmez.
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

        const validations = pickValidations(body?.validations);
        if (!validations) {
            return NextResponse.json({ error: 'Bu demoda yalnız 18+ ve user_id sorulabilir' }, { status: 400 });
        }

        // Keep public_key, cf_token (dropping it silently disables bot protection), sdk_version and
        // additional_data (the mobile SDKs call it custom_data) from the client; validations come
        // from the server (see above).
        const upstreamBody = {
            public_key: body?.public_key,
            cf_token: body?.cf_token,
            sdk_version: body?.sdk_version,
            additional_data: body?.additional_data,
            custom_data: body?.custom_data,
            validations,
        };

        const response = await fetch(`${apiUrl}/api/pop/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                // Forward the browser's language so VerifyBlind localizes errors (tr/en).
                'Accept-Language': req.headers.get('accept-language') || 'tr'
            },
            body: JSON.stringify(upstreamBody) // undefined fields are dropped
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(
                { error: (data as any).error || `API hatası: ${response.status}` },
                { status: response.status }
            );
        }

        // Remember the nonce TOGETHER WITH what was asked, so /api/verify can one-time-consume it
        // (replay protection) and read the signed result against the asked condition.
        if (typeof data.nonce === 'string' && data.nonce) {
            await store.set(`${NONCE_PREFIX}${data.nonce}`, JSON.stringify(validations), 'EX', NONCE_TTL);
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
