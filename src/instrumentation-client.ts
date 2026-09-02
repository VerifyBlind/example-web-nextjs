import * as Sentry from '@sentry/nextjs'

function maskPii(str: string): string {
  return str
    .replace(/\b[1-9]\d{10}\b/g, '[TCKN]')
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_EXAMPLES_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  // 3 example portal (nextjs/dotnet/php) tek Sentry projesine raporlar — bu tag hangisi olduğunu ayırır.
  initialScope: { tags: { example_stack: 'nextjs' } },
  beforeSend(event) {
    if (event.message) event.message = maskPii(event.message)
    event.exception?.values?.forEach((ex) => {
      if (ex.value) ex.value = maskPii(ex.value)
    })
    return event
  },
})

// Client-side navigasyon (App Router) enstrümantasyonu — Sentry v9+ Turbopack uyumu için gerekli
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
