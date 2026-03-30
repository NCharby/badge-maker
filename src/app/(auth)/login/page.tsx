'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--sd-border)',
  borderRadius: '7px',
  fontSize: '14px',
  color: 'var(--sd-text)',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: 'var(--sd-red)',
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError || !user) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    // Role-based redirect only when there's no specific destination
    let destination = next
    if (destination === '/dashboard') {
      const { data: platformUser } = await supabase
        .from('platform_users')
        .select('role')
        .eq('id', user.id)
        .single()
      const role = platformUser?.role
      if (role === 'system_admin') destination = '/admin/dashboard'
      else if (role === 'event_promoter') destination = '/ep/dashboard'
    }

    router.push(destination)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div
          style={{
            background: 'var(--sd-red-light)',
            border: '1px solid #FCA5A5',
            color: '#991b1b',
            borderRadius: '7px',
            padding: '10px 14px',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label
          style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}
        >
          Email address
        </label>
        <input
          style={error ? inputErrorStyle : inputStyle}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          autoFocus
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '5px',
          }}
        >
          <label style={{ fontSize: '13px', fontWeight: 500 }}>Password</label>
          <Link
            href="/reset-password"
            tabIndex={-1}
            style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}
          >
            Forgot your password?
          </Link>
        </div>
        <input
          style={inputStyle}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '10px 20px',
          borderRadius: '7px',
          fontSize: '14px',
          fontWeight: 500,
          background: loading ? 'var(--sd-muted)' : 'var(--sd-green)',
          color: '#fff',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '16px',
        }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '16px 0',
          color: 'var(--sd-xs)',
          fontSize: '12px',
        }}
      >
        <div style={{ flex: 1, height: '1px', background: 'var(--sd-border)' }} />
        or
        <div style={{ flex: 1, height: '1px', background: 'var(--sd-border)' }} />
      </div>

      <Link
        href="/register"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '10px 20px',
          borderRadius: '7px',
          fontSize: '14px',
          fontWeight: 500,
          background: '#fff',
          border: '1px solid var(--sd-border)',
          color: 'var(--sd-text)',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        Create an account
      </Link>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div
      style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}
    >
      <h1
        style={{
          fontSize: '18px',
          fontWeight: 700,
          marginBottom: '24px',
          textAlign: 'center',
          color: 'var(--sd-text)',
        }}
      >
        Sign in to your account
      </h1>
      <LoginForm />
      <p
        style={{
          fontSize: '12px',
          color: 'var(--sd-muted)',
          textAlign: 'center',
          marginTop: '20px',
        }}
      >
        By signing in you agree to our{' '}
        <a href="#" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
          Terms of Service
        </a>
      </p>
    </div>
  )
}
