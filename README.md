# VerifyBlind — Web Entegrasyon Örneği (Next.js)

**[🇹🇷 Türkçe](#türkçe) · [🇬🇧 English](#english)**

VerifyBlind'i bir web sitesine nasıl entegre edeceğinizi gösteren örnek (Next.js, App Router).
`example-web-php` ile **aynı (tarayıcı-decrypt / PoP) akışın** Next.js sürümüdür; `example-web-dotnet`
ise **sunucu-decrypt (callback/webhook)** varyantını gösterir.

---

## Türkçe

### Akış
1. **Sunucu-taraflı proxy** — Tarayıcı `POST /api/generate` çağırır; sunucu `X-API-Key`'i ekleyip
   VerifyBlind `POST /api/pop/generate`'e iletir ve bir `nonce` döner. **API anahtarı tarayıcıya hiç
   gösterilmez.** (`src/app/api/generate/route.ts`)
2. **Doğrulama** — Kullanıcı QR'ı VerifyBlind mobil ile okutur (`src/app/send2mobile/`); doğrulama
   bitince partner'a imzalı bir token döner.
3. **İmza kontrolü** — `POST /api/verify` token'ı alır, `GET /api/public/enclave-key` ile enclave'in
   public key'ini çekip **RSA-PSS imzasını** doğrular ve nonce'u tek-kullanımlık tüketir.
   (`src/app/api/verify/route.ts`)

### Çalıştırma
```bash
npm install
# .env.local oluşturun:
#   TEST_VERIFYBLIND_API_KEY=<partner API anahtarınız>
#   VERIFYBLIND_API_URL=https://api.verifyblind.com   # varsayılan
npm run dev          # http://localhost:3000
```

> Demo nonce deposu tek-instance içindir; üretimde Redis/DB kullanın (`src/lib/redis.ts`).

🌐 [verifyblind.com](https://verifyblind.com) · 🧩 [PHP örneği](https://github.com/VerifyBlind/example-web-php) · 🧩 [.NET örneği](https://github.com/VerifyBlind/example-web-dotnet)

---

## English

An example of integrating VerifyBlind into a website (Next.js, App Router). It is the Next.js version of
the **same (browser-decrypt / PoP) flow** as `example-web-php`; `example-web-dotnet` shows the
**server-decrypt (callback/webhook)** variant.

### Flow
1. **Server-side proxy** — The browser calls `POST /api/generate`; the server adds the `X-API-Key` and
   forwards it to VerifyBlind `POST /api/pop/generate`, returning a `nonce`. **The API key is never
   exposed to the browser.** (`src/app/api/generate/route.ts`)
2. **Verification** — The user scans the QR with VerifyBlind mobile (`src/app/send2mobile/`); on success
   a signed token is returned to the partner.
3. **Signature check** — `POST /api/verify` takes the token, fetches the enclave public key via
   `GET /api/public/enclave-key`, verifies the **RSA-PSS signature**, and consumes the nonce once.
   (`src/app/api/verify/route.ts`)

### Running
```bash
npm install
# Create .env.local:
#   TEST_VERIFYBLIND_API_KEY=<your partner API key>
#   VERIFYBLIND_API_URL=https://api.verifyblind.com   # default
npm run dev          # http://localhost:3000
```

> The demo nonce store is single-instance only; use Redis/DB in production (`src/lib/redis.ts`).

🌐 [verifyblind.com](https://verifyblind.com) · 🧩 [PHP example](https://github.com/VerifyBlind/example-web-php) · 🧩 [.NET example](https://github.com/VerifyBlind/example-web-dotnet)
