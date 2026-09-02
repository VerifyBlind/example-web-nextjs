'use client'

// Next.js App Router kök hata sınırı (root error boundary). Root layout dahil render
// sırasında oluşan client hatalarını yakalar ve Sentry'e iletir. Bu dosya olmadan
// kökteki render hataları Sentry'ye GÖNDERİLMEZ (Next.js varsayılan hata ekranını gösterir).
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f8fafc',
          color: '#0f172a',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: '0 0 8px' }}>
            Beklenmeyen bir hata oluştu
          </h1>
          <p style={{ color: '#64748b', margin: '0 0 20px', fontSize: 14 }}>
            Hata kaydedildi. Lütfen tekrar deneyin.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  )
}
