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
   gösterilmez.** Tarayıcıdan `public_key`, `sdk_version` (ve `additional_data`) aynen
   alınır; **ne sorulacağına (`validations`) sunucu karar verir** — tarayıcıdaki istek değiştirilebilir,
   `"18+"` yerine `"1+"` soran biri de imzalı `age: true` alır. Bu demo ziyaretçinin seçimini yalnız bir
   izin listesinden (`18+`, `user_id`) kabul eder; gerçek bir site `validations`'ı kendi ayarından koyar.
   Sorulan koşul nonce ile birlikte saklanır. Widget'ta bot koruması yoktur: gerçek bir site bu
   ucu kendi tarafında korur (ör. oturum, hız sınırı ya da kendi bot koruması). (`src/app/api/generate/route.ts`)
2. **Doğrulama** — Kullanıcı QR'ı VerifyBlind mobil ile okutur (`src/app/send2mobile/`); doğrulama
   bitince partner'a imzalı bir token döner.
3. **İmza kontrolü** — `POST /api/verify` token'ı alır ve resmi
   [`@verifyblind/server`](https://www.npmjs.com/package/@verifyblind/server) kütüphanesine verir:
   ```ts
   const verifier = createVerifier({ allowTestCards: true }); // test partneri: demo kart kabul
   const r = await verifier.verifyAndConsume(token, (nonce) => store.getdel('popnonce:' + nonce));
   ```
   Kütüphane enclave'in **RSA-PSS imzasını** doğrular (anahtar `GET /api/public/enclave-key`), nonce'u
   tek-kullanımlık tüketir ve sonucu **nonce ile saklanan koşula göre** okur: imzalı
   `validations.age_condition` zorunludur ve sorulan koşula eşit olmalıdır; yoksa ya da farklıysa sonuç
   reddedilir. Hata kodu (`r.error.code`) HTTP durumuna çevrilir. Gerçek bir site `allowTestCards`'ı
   vermez (demo kart sonuçları o zaman `TEST_CARD` ile reddedilir). Kimlik kodları (`user_id`,
   `nsbd_id`, `doc_id`) hiçbir log'a yazılmaz. (`src/app/api/verify/route.ts`)

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
   exposed to the browser.** `public_key`, `sdk_version` (and `additional_data`) are taken
   from the browser unchanged; **the server decides what is asked (`validations`)** — the browser
   request can be edited, and someone who asks `"1+"` instead of `"18+"` also gets a signed `age: true`.
   This demo accepts the visitor's choice only from an allow-list (`18+`, `user_id`); a real site sets
   `validations` from its own configuration. The asked condition is stored with the nonce. The widget
   has no bot protection: a real site protects this endpoint on its own side (e.g. a session, a rate
   limit or its own bot protection).
   (`src/app/api/generate/route.ts`)
2. **Verification** — The user scans the QR with VerifyBlind mobile (`src/app/send2mobile/`); on success
   a signed token is returned to the partner.
3. **Signature check** — `POST /api/verify` takes the token and hands it to the official
   [`@verifyblind/server`](https://www.npmjs.com/package/@verifyblind/server) library:
   ```ts
   const verifier = createVerifier({ allowTestCards: true }); // test partner: demo card accepted
   const r = await verifier.verifyAndConsume(token, (nonce) => store.getdel('popnonce:' + nonce));
   ```
   The library verifies the enclave **RSA-PSS signature** (key from `GET /api/public/enclave-key`),
   consumes the nonce once, and reads the result **against the condition stored with the nonce**: the
   signed `validations.age_condition` is required and must equal the asked condition; missing or
   different → rejected. The error code (`r.error.code`) is mapped to an HTTP status. A real site leaves
   out `allowTestCards` (demo-card results are then rejected with `TEST_CARD`). Identity codes
   (`user_id`, `nsbd_id`, `doc_id`) are never written to any log. (`src/app/api/verify/route.ts`)

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

---

## Lisans · License

Apache License 2.0 — bkz. / see [LICENSE](LICENSE).
