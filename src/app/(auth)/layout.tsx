import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SD Platform',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--sd-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <a
          href="/"
          style={{
            fontWeight: 600,
            fontSize: '1.25rem',
            color: 'var(--sd-text)',
            textDecoration: 'none',
          }}
        >
          🐕 SD Platform
        </a>
      </div>
      {children}
    </div>
  )
}
