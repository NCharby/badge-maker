'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registerDevUser } from './actions'

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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [dob, setDob] = useState('')
  const [telegramHandle, setTelegramHandle] = useState('')
  const [sceneName, setSceneName] = useState('')
  const [tosAccepted, setTosAccepted] = useState(false)

  // Organization (optional)
  const [createOrg, setCreateOrg] = useState(false)
  const [orgName, setOrgName] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!firstName.trim()) newErrors.firstName = 'First name is required.'
    if (!lastName.trim()) newErrors.lastName = 'Last name is required.'
    if (!email) newErrors.email = 'Email is required.'
    if (!password) newErrors.password = 'Password is required.'
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters.'
    else if (!/[A-Z]/.test(password) || !/\d/.test(password))
      newErrors.password = 'Password must contain at least 1 uppercase letter and 1 number.'
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match.'
    if (!dob) newErrors.dob = 'Date of birth is required.'
    else if (!isAtLeast21(dob)) newErrors.dob = 'You must be 21 or older to create an account.'
    if (createOrg && !orgName.trim()) newErrors.orgName = 'Organization name is required when creating an organization.'
    if (!tosAccepted) newErrors.tos = 'You must agree to the Terms of Service.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGlobalError('')

    if (!validate()) return

    setLoading(true)

    // Strip '@' prefix from telegram handle per spec
    const cleanHandle = telegramHandle.replace(/^@/, '').trim() || null

    // Dev path: use admin API to bypass Supabase email format validation and rate limits.
    // UI gated by NEXT_PUBLIC_DEBUG; server action gated by server-only DEBUG_REGISTRATION_KEY.
    // Server action creates the user and platform_users row; sign-in happens client-side
    // using the browser Supabase client (canonical Next.js App Router pattern).
    if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
      const result = await registerDevUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
        dob,
        telegramHandle: cleanHandle,
        sceneName: sceneName.trim() || null,
        orgName: createOrg ? orgName.trim() : null,
      })
      if (result?.error) { setLoading(false); setGlobalError(result.error); return }
      if (result?.success) {
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        setLoading(false)
        if (signInError) { setGlobalError(`Account created but sign-in failed: ${signInError.message}`); return }
        router.push('/dashboard')
      }
      return
    }

    const supabase = createClient()

    // Production path: signUp with user_metadata; platform_users row created in auth/callback
    // after email confirmation (see src/app/auth/callback/route.ts).
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dob,
          telegram_handle: cleanHandle,
          preferred_scene_name: sceneName.trim() || null,
          org_name: createOrg ? orgName.trim() : null,
        },
      },
    })

    if (signUpError) {
      setGlobalError(signUpError.message)
      setLoading(false)
      return
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              First name
            </label>
            <input
              style={errors.firstName ? inputErrorStyle : inputStyle}
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoFocus
            />
            {errors.firstName && <p style={errorStyle}>{errors.firstName}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Last name
            </label>
            <input
              style={errors.lastName ? inputErrorStyle : inputStyle}
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
            {errors.lastName && <p style={errorStyle}>{errors.lastName}</p>}
          </div>
        </div>

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

        {/* Organization (optional) */}
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          borderRadius: '7px',
          border: `1px solid ${createOrg ? 'var(--sd-green)' : 'var(--sd-border)'}`,
          background: createOrg ? 'var(--sd-green-light)' : 'var(--sd-card)',
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={createOrg}
              onChange={(e) => setCreateOrg(e.target.checked)}
              style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }}
            />
            <span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>
                Create an Organization
              </span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                Set up an organization to manage events and invite team members. Free to start.
              </span>
            </span>
          </label>
          {createOrg && (
            <div style={{ marginTop: '12px', paddingLeft: '26px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                Organization Name *
              </label>
              <input
                style={errors.orgName ? inputErrorStyle : inputStyle}
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Shiny Dog Productions"
              />
              {errors.orgName && <p style={errorStyle}>{errors.orgName}</p>}
              <p style={hintStyle}>
                You&apos;ll be the Organization Lead with full management access.
              </p>
            </div>
          )}
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
