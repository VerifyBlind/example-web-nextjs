import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';
import store from '@/lib/redis';

// Must match the prefix used in /api/generate.
const NONCE_PREFIX = 'popnonce:';

// Enclave public key kısa TTL ile cache — enclave restart edince yeni key üretiyor,
// bu yüzden uzun cache stale verifying'e sebep oluyor.
let cachedEnclaveKey: string | null = null;
let cachedAt = 0;
const KEY_CACHE_TTL_MS = 60_000; // 60 sn

async function fetchEnclaveKey(): Promise<string> {
    const res = await fetch('https://api.verifyblind.com/api/public/enclave-key', { cache: 'no-store' });
    if (!res.ok) throw new Error('Enclave public key alınamadı');
    return await res.text();
}

async function getEnclaveKey(forceRefresh = false): Promise<string> {
    const isExpired = Date.now() - cachedAt > KEY_CACHE_TTL_MS;
    if (!forceRefresh && cachedEnclaveKey && !isExpired) return cachedEnclaveKey;
    cachedEnclaveKey = await fetchEnclaveKey();
    cachedAt = Date.now();
    return cachedEnclaveKey;
}

function verifyWithKey(payload: string, signature: string, enclaveKey: string): boolean {
    // Enclave public key base64 SPKI → PEM
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${enclaveKey.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
    return crypto.verify(
        'sha256',
        Buffer.from(payload),
        {
            key: pemKey,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
            saltLength: 32
        },
        Buffer.from(signature, 'base64')
    );
}

// ── Enclave doğrulama (opsiyonel, Partner_Integration_Guide_TR.md Bölüm 7) ──────────────
// SDK, doğrulama sonucuyla birlikte `attestation.pcr0_signature` ve `attestation.attestation_document`
// verir (onSuccess verisinde). Aşağıdaki kontrol, konuştuğunuz enclave'in halka açık kaynaktan
// yeniden üretilebilir şekilde derlenmiş sürüm olduğunu VerifyBlind'a güvenmeden teyit eder.
//
// Bu örnek portal akışı bloke ETMEZ — istemci şu an rotaya yalnız payload+signature gönderiyor.
// Kendi entegrasyonunuzda kanıtı da backend'e taşıyıp bu kontrolü ZORUNLU yapabilirsiniz.

let cachedDeveloperKey: string | null = null;
let developerKeyCachedAt = 0;

async function getDeveloperKey(): Promise<string> {
    // Rotasyona kadar sabit; yine de bir saatlik tazeleme bırakıyoruz.
    if (cachedDeveloperKey && Date.now() - developerKeyCachedAt < 3_600_000) return cachedDeveloperKey;
    const res = await fetch('https://api.verifyblind.com/api/public/developer-key', { cache: 'no-store' });
    if (!res.ok) throw new Error('Geliştirici public key alınamadı');
    const json = await res.json();
    cachedDeveloperKey = json.public_key as string;
    developerKeyCachedAt = Date.now();
    return cachedDeveloperKey;
}

/**
 * PCR0 yetkilendirme imzasını doğrular.
 *
 * DİKKAT: padding burada PKCS#1 v1.5'tir — enclave'in SONUÇ imzası ise PSS
 * (bkz. verifyWithKey). Karıştırmak sessizce false döndürür.
 *
 * İkinci adım: pcr0Hex'i Enclave repo'sunun son release'indeki expected_pcr.json ile
 * karşılaştırın (https://github.com/VerifyBlind/VerifyBlind-Enclave/releases/latest).
 */
export async function verifyPcr0Signature(pcr0Hex: string, pcr0SignatureB64: string): Promise<boolean> {
    try {
        return crypto.verify(
            'sha256',
            Buffer.from(pcr0Hex, 'utf8'),
            { key: await getDeveloperKey(), padding: crypto.constants.RSA_PKCS1_PADDING },
            Buffer.from(pcr0SignatureB64, 'base64')
        );
    } catch {
        return false;
    }
}

/**
 * POST /api/verify
 * token (base64) parse eder → Enclave imzasını RSA-PSS SHA-256 ile doğrular.
 * İlk denemede başarısız olursa enclave public key'i tazeleyip tekrar dener
 * (enclave restart sonrası stale cache durumu için).
 * Geçerliyse { success: true, data: parsedPayload } döner.
 */
export async function POST(req: NextRequest) {
    try {
        const { token } = await req.json();
        if (!token) {
            return NextResponse.json({ error: 'token gerekli' }, { status: 400 });
        }

        const { payload, signature } = JSON.parse(
            Buffer.from(token, 'base64').toString()
        );

        let enclaveKey = await getEnclaveKey();
        let isValid = verifyWithKey(payload, signature, enclaveKey);

        // Stale cache koruması — bir kez force refresh ile yeniden dene.
        if (!isValid) {
            console.warn('[TestPortal Verify] İmza ilk denemede başarısız — enclave key tazeleniyor.');
            enclaveKey = await getEnclaveKey(true);
            isValid = verifyWithKey(payload, signature, enclaveKey);
        }

        if (!isValid) {
            return NextResponse.json({ error: 'Geçersiz imza' }, { status: 401 });
        }

        const data = JSON.parse(payload);

        // Replay protection: bind the signed nonce to a session this portal generated
        // and consume it exactly once.
        const sessionNonce = data?.nonce;
        if (typeof sessionNonce !== 'string' || !sessionNonce) {
            return NextResponse.json({ error: 'Geçersiz oturum (nonce yok)' }, { status: 400 });
        }
        const consumed = await store.getdel(`${NONCE_PREFIX}${sessionNonce}`);
        if (!consumed) {
            return NextResponse.json({ error: 'Oturum süresi dolmuş veya zaten kullanılmış' }, { status: 401 });
        }

        console.log(`[TestPortal Verify] ✅ İmza doğrulandı, user_id: ${data?.validations?.user_id}`);
        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        Sentry.captureException(error);
        console.error('[TestPortal Verify] Hata:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
