'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrgSettings } from '../actions'

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

const SOCIAL_PLATFORMS = ['Twitter / X', 'Bluesky', 'Discord', 'Instagram', 'Fetlife'] as const

type SocialEntry = { key: string; value: string }

export default function OrgSettingsClient({
  orgSlug,
  org,
}: {
  orgSlug: string
  org: {
    name: string
    website: string
    socialMedia: SocialEntry[]
    paymentProvider: 'square' | 'paypal' | null
  }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [name, setName] = useState(org.name)
  const [website, setWebsite] = useState(org.website)
  const [paymentProvider, setPaymentProvider] = useState<'square' | 'paypal'>(org.paymentProvider ?? 'square')

  // Social media
  const initSocials = (): SocialEntry[] => {
    const existing = org.socialMedia
    const standard = SOCIAL_PLATFORMS.map(p => ({
      key: p,
      value: existing.find(e => e.key === p)?.value || '',
    }))
    const custom = existing.filter(e => !(SOCIAL_PLATFORMS as readonly string[]).includes(e.key))
    return [...standard, ...custom]
  }
  const [socials, setSocials] = useState<SocialEntry[]>(initSocials)

  function handleSave() {
    setError('')
    setSuccess(false)
    startTransition(async () => {
      const result = await updateOrgSettings(orgSlug, {
        name: name.trim(),
        website: website.trim(),
        socialMedia: socials.filter(s => s.value.trim()),
        paymentProvider,
      })
      if ('error' in result) setError(result.error)
      else { setSuccess(true); router.refresh() }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Name */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--sd-text)' }}>
          Organization Name
        </label>
        <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>

      {/* Website */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--sd-text)' }}>
          Website
        </label>
        <input style={inputStyle} type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" />
      </div>

      {/* Social Media */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--sd-text)' }}>
          Social Media
        </label>
        {socials.map((social, i) => (
          <div key={`${social.key}-${i}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sd-muted)', paddingTop: '10px' }}>{social.key}</span>
            <input
              style={inputStyle}
              type="text"
              value={social.value}
              onChange={e => setSocials(prev => prev.map((s, j) => j === i ? { ...s, value: e.target.value } : s))}
              placeholder="username or URL"
            />
          </div>
        ))}
      </div>

      {/* Payment Provider */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'var(--sd-text)' }}>
          Payment Provider
        </label>
        {(['square', 'paypal'] as const).map(p => (
          <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input
              type="radio"
              name="payment_provider"
              value={p}
              checked={paymentProvider === p}
              onChange={() => setPaymentProvider(p)}
              style={{ accentColor: 'var(--sd-green)', width: '16px', height: '16px' }}
            />
            {p === 'square' ? 'Square' : 'PayPal'}
          </label>
        ))}
        <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
          Applies to all events managed by this organization.
        </p>
      </div>

      {/* Status messages */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid #FCA5A5', background: 'var(--sd-red-light)', color: '#991b1b' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid #6EE7B7', background: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' }}>
          Settings saved.
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isPending}
        style={{
          padding: '10px 24px', borderRadius: '7px', fontSize: '14px', fontWeight: 600, border: 'none',
          background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)', color: '#fff',
          cursor: isPending ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
        }}
      >
        {isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
