'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--sd-muted)',
  marginTop: '3px',
}

const errorStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--sd-red)',
  marginTop: '4px',
}

/** Returns true if the given ISO date string is 21+ years ago. */
function isAtLeast21(dob: string): boolean {
  if (!dob) return false
  const dobDate = new Date(dob)
  const today = new Date()
  const cutoff = new Date(today.getFullYear() - 21, today.getMonth(), today.getDate())
  return dobDate <= cutoff
}

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dob, setDob] = useState('')
  const [telegramHandle, setTelegramHandle] = useState('')
  const [sceneName, setSceneName] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!email) newErrors.email = 'Email is required.'
    if (!password) newErrors.password = 'Password is required.'
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters.'
    else if (!/[A-Z]/.test(password) || !/\d/.test(password))
      newErrors.password = 'Password must contain at least 1 uppercase letter and 1 number.'
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.'
    if (!dob) newErrors.dob = 'Date of birth is required.'
    else if (!isAtLeast21(dob)) newErrors.dob = 'You must be 21 or older to create an account.'
    if (!tosAccepted) newErrors.tos = 'You must agree to the Terms of Service.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')

    if (!validate()) return

    setLoading(true)

    const supabase = createClient()

    // Strip '@' prefix from telegram handle per spec
    const cleanHandle = telegramHandle.replace(/^@/, '').trim() || null

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })

    if (signUpError) {
      setGlobalError(signUpError.message)
      setLoading(false)
      return
    }

    // Create platform_users record (RLS allows auth.uid() = id on INSERT)
    if (data.user) {
      const { error: profileError } = await supabase.from('platform_users').insert({
        id: data.user.id,
        email,
        date_of_birth: dob,
        telegram_handle: cleanHandle,
        preferred_scene_name: sceneName.trim() || null,
        role: 'user',
      })

      if (profileError) {
        setGlobalError('Account created but profile setup failed. Please contact support.')
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div
        style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '32px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📧</div>
        <h2
          style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--sd-text)' }}
        >
          Check your email
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
          We sent a verification link to <strong>{email}</strong>. Click the link to activate your
          account.
        </p>
        <Link
          href="/login"
          style={{
            display: 'inline-block',
            padding: '9px 24px',
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
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '32px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}
    >
      <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--sd-text)' }}>
        Create your account
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        You must be 21 or older to register.
      </p>

      {globalError && (
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
          {globalError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Email address
          </label>
          <input
            style={errors.email ? inputErrorStyle : inputStyle}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
          {errors.email && <p style={errorStyle}>{errors.email}</p>}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Password
          </label>
          <input
            style={errors.password ? inputErrorStyle : inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            autoComplete="new-password"
          />
          <p style={hintStyle}>8+ characters, at least 1 number and 1 uppercase letter</p>
          {errors.password && <p style={errorStyle}>{errors.password}</p>}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Confirm password
          </label>
          <input
            style={errors.confirmPassword ? inputErrorStyle : inputStyle}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
          {errors.confirmPassword && <p style={errorStyle}>{errors.confirmPassword}</p>}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Date of birth
          </label>
          <input
            style={errors.dob ? inputErrorStyle : inputStyle}
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          {errors.dob && (
            <div
              style={{
                background: 'var(--sd-red-light)',
                border: '1px solid #FCA5A5',
                color: '#991b1b',
                borderRadius: '7px',
                padding: '8px 12px',
                fontSize: '13px',
                marginTop: '6px',
              }}
            >
              ✕ {errors.dob}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Telegram handle{' '}
            <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            style={inputStyle}
            type="text"
            value={telegramHandle}
            onChange={(e) => setTelegramHandle(e.target.value)}
            placeholder="@yourhandle"
            autoComplete="off"
          />
          <p style={hintStyle}>
            You&apos;ll verify this after registration. The bot will send you a confirmation code.
          </p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Preferred scene name{' '}
            <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            style={inputStyle}
            type="text"
            value={sceneName}
            onChange={(e) => setSceneName(e.target.value)}
            placeholder="e.g. JadeFox"
          />
          <p style={hintStyle}>
            Displayed in the Roommate Finder, badges, and notifications. Leave blank to use your
            email username.
          </p>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}
        >
          <input
            type="checkbox"
            id="tos"
            checked={tosAccepted}
            onChange={(e) => setTosAccepted(e.target.checked)}
            style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }}
          />
          <label htmlFor="tos" style={{ fontSize: '13px', color: 'var(--sd-muted)', lineHeight: 1.4 }}>
            I agree to the{' '}
            <a href="#" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
              Privacy Policy
            </a>
            . I confirm I am 21 years of age or older.
          </label>
        </div>
        {errors.tos && <p style={{ ...errorStyle, marginTop: '-12px', marginBottom: '12px' }}>{errors.tos}</p>}

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
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--sd-muted)', marginTop: '16px' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--sd-green)', textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
