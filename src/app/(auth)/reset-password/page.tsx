'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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

/** Password strength: 0=empty, 1=weak, 2=fair, 3=strong */
function passwordStrength(pw: string): number {
  if (pw.length === 0) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++
  return score
}

const strengthLabels = ['', 'Weak', 'Fair', 'Strong']
const strengthColors = ['', 'var(--sd-red)', 'var(--sd-amber)', 'var(--sd-green)']

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  // After the callback route processes the recovery token and redirects here,
  // the user will have an active session with type='recovery'.
  // We detect this by checking for an auth session event.
  const [mode, setMode] = useState<'request' | 'set-password' | 'request-sent' | 'success'>('request')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const strength = passwordStrength(newPassword)

  // If the URL indicates a recovery session (redirected from /auth/callback?type=recovery),
  // switch to set-password mode.
  useEffect(() => {
    if (searchParams.get('type') === 'recovery') {
      setMode('set-password')
      return
    }
    // Also check for an active recovery session via Supabase
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('set-password')
      }
    })
  }, [searchParams])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email) { setError('Email address is required.'); return }
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?type=recovery&next=/reset-password`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setMode('request-sent')
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must contain at least 1 uppercase letter and 1 number.')
      return
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }
    setMode('success')
  }

  // ── Request sent state ────────────────────────────────────────────────────
  if (mode === 'request-sent') {
    return (
      <>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>📧</div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', color: 'var(--sd-text)' }}>
          Check your email
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)', textAlign: 'center', marginBottom: '24px' }}>
          We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set
          a new password.
        </p>
        <Link
          href="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            borderRadius: '7px',
            background: 'var(--sd-green)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Back to sign in
        </Link>
      </>
    )
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (mode === 'success') {
    return (
      <>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', color: 'var(--sd-text)' }}>
          Password updated
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)', textAlign: 'center', marginBottom: '24px' }}>
          Your password has been changed successfully. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            borderRadius: '7px',
            background: 'var(--sd-green)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Sign in
        </Link>
      </>
    )
  }

  // ── Set new password (post-email-link) ────────────────────────────────────
  if (mode === 'set-password') {
    return (
      <>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--sd-text)' }}>
          Set new password
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          Choose a strong password for your account.
        </p>
        {error && (
          <div style={{ background: 'var(--sd-red-light)', border: '1px solid #FCA5A5', color: '#991b1b', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSetPassword}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              New password
            </label>
            <input
              style={error && !newPassword ? inputErrorStyle : inputStyle}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Create a new password"
              autoFocus
            />
            {newPassword.length > 0 && (
              <div style={{ marginTop: '6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      background: strength >= i ? strengthColors[strength] : 'var(--sd-border)',
                      transition: 'background 0.2s',
                    }}
                  />
                ))}
                <span style={{ fontSize: '11px', color: strengthColors[strength], marginLeft: '4px', minWidth: '40px' }}>
                  {strengthLabels[strength]}
                </span>
              </div>
            )}
            <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
              8+ characters, at least 1 uppercase letter and 1 number
            </p>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Confirm new password
            </label>
            <input
              style={inputStyle}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat your new password"
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
            }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </>
    )
  }

  // ── Request reset (default) ───────────────────────────────────────────────
  return (
    <>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--sd-text)' }}>
        Reset your password
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        Enter your email and we&apos;ll send you a reset link.
      </p>
      {error && (
        <div style={{ background: 'var(--sd-red-light)', border: '1px solid #FCA5A5', color: '#991b1b', borderRadius: '7px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px' }}>
          {error}
        </div>
      )}
      <form onSubmit={handleRequestReset}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Email address
          </label>
          <input
            style={error ? inputErrorStyle : inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            autoComplete="email"
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
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
        <Link
          href="/login"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            borderRadius: '7px',
            fontSize: '14px',
            fontWeight: 500,
            background: '#fff',
            border: '1px solid var(--sd-border)',
            color: 'var(--sd-text)',
            textDecoration: 'none',
          }}
        >
          Back to sign in
        </Link>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
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
      <Suspense>
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
