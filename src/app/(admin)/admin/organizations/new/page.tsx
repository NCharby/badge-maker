'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createOrganization } from '../actions'

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

export default function NewOrganizationPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [paymentProvider, setPaymentProvider] = useState<'square' | 'paypal'>('square')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Organization name is required.'); return }

    startTransition(async () => {
      const result = await createOrganization({
        name: name.trim(),
        website: website.trim() || undefined,
        paymentProvider,
      })
      if ('error' in result) {
        setError(result.error)
      } else {
        router.push(`/admin/organizations/${result.orgId}`)
      }
    })
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href="/admin/organizations" style={{ fontSize: '13px', color: 'var(--sd-green)', textDecoration: 'none' }}>
          &larr; Organizations
        </Link>
      </div>

      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '24px' }}>
        Create Organization
      </h1>

      <form onSubmit={handleSubmit}>
        <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '24px', marginBottom: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Organization Name *
            </label>
            <input
              style={inputStyle}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Shiny Dog Productions"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
              Website <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              style={inputStyle}
              type="url"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
              Payment Provider
            </label>
            {(['square', 'paypal'] as const).map(p => (
              <label
                key={p}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
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
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '7px', fontSize: '13px', border: '1px solid #FCA5A5', background: 'var(--sd-red-light)', color: '#991b1b', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '10px 24px',
            borderRadius: '7px',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)',
            color: '#fff',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Creating...' : 'Create Organization'}
        </button>
      </form>
    </div>
  )
}
