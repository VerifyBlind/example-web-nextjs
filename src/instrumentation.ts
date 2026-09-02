import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
    // Açılış ping'i: sunucu her başladığında tek Info event'i (Sentry sağlık kontrolü).
    // DSN boşsa no-op. register() Next.js'in garantili sunucu-açılış hook'u.
    Sentry.captureMessage('[startup] example-web-nextjs up', 'info')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Sunucu tarafı hataları (React Server Component, server action, route handler, SSR/nested render)
// Sentry'e iletir. Next.js bu hook'u nested RSC hatalarını yakalamak için ZORUNLU kılar —
// yoksa try/catch ile yutulmayan birçok sunucu hatası Sentry'ye hiç ulaşmaz.
export const onRequestError = Sentry.captureRequestError
