'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PlatformUser, getDisplayName } from '@/types/platform'
import { updateProfile, requestEmailChange, updatePaymentProvider, sendTelegramVerificationCode } from './actions'

const SOCIAL_PLATFORMS = ['Twitter / X', 'Bluesky', 'Discord', 'Instagram', 'Recon', 'Fetlife'] as const

type SocialEntry = { key: string; value: string; isCustom: boolean }

function initSocials(data: { key: string; value: string }[] | null): SocialEntry[] {
  const existing = data || []
  const standard: SocialEntry[] = SOCIAL_PLATFORMS.map(platform => ({
    key: platform,
    value: existing.find(e => e.key === platform)?.value || '',
    isCustom: false,
  }))
  const custom: SocialEntry[] = existing
    .filter(e => !(SOCIAL_PLATFORMS as readonly string[]).includes(e.key))
    .map(e => ({ key: e.key, value: e.value, isCustom: true }))
  return [...standard, ...custom]
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      style={{
        position: 'relative',
        width: '44px',
        height: '24px',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '24px',
          background: checked ? 'var(--sd-green)' : '#D1D5DB',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '18px',
            height: '18px',
            left: checked ? '23px' : '3px',
            bottom: '3px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </label>
  )
}

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

type SectionKey = 'profile' | 'contact' | 'social' | 'telegram' | 'privacy' | 'notifications' | 'age' | 'payment'

const SECTIONS: { key: SectionKey; label: string; epOnly?: boolean }[] = [
  { key: 'profile', label: 'Display Name & Photo' },
  { key: 'contact', label: 'Contact Info' },
  { key: 'social', label: 'Social Media' },
  { key: 'telegram', label: 'Telegram' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'age', label: 'Age Verification' },
  { key: 'payment', label: 'Payment Settings', epOnly: true },
]

export default function ProfileForm({ user }: { user: PlatformUser }) {
  const router = useRouter()
  const displayName = getDisplayName(user)
  const initials = displayName.slice(0, 2).toUpperCase()

  // Section accordion state
  const [openSection, setOpenSection] = useState<SectionKey | null>('profile')

  // Form state
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [preferredName, setPreferredName] = useState(user.preferred_scene_name || '')
  const [otherNames, setOtherNames] = useState<string[]>(user.other_scene_names || [])
  const [nameInput, setNameInput] = useState('')
  const [phone, setPhone] = useState(user.phone || '')
  const [zipCode, setZipCode] = useState(user.zip_code || '')
  const [emergencyContact, setEmergencyContact] = useState(user.emergency_contact || '')
  const [emergencyPhone, setEmergencyPhone] = useState(user.emergency_phone || '')
  const [socials, setSocials] = useState<SocialEntry[]>(initSocials(user.social_media))
  const [customKeyInput, setCustomKeyInput] = useState('')
  const [telegramHandle, setTelegramHandle] = useState(user.telegram_handle || '')
  const [roommateHidden, setRoommateHidden] = useState(user.roommate_finder_hidden)
  const [emailNotifs, setEmailNotifs] = useState(user.email_notifications_enabled)
  const [telegramNotifs, setTelegramNotifs] = useState(user.telegram_notifications_enabled)

  // Payment provider (EP/admin only)
  const isEpOrAdmin = user.role === 'event_promoter' || user.role === 'system_admin'
  const [paymentProvider, setPaymentProvider] = useState<'square' | 'paypal'>(
    user.payment_provider ?? 'square'
  )
  const [isPaymentPending, startPaymentTransition] = useTransition()
  const [paymentSaveStatus, setPaymentSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [paymentSaveError, setPaymentSaveError] = useState('')

  function handlePaymentSave() {
    setPaymentSaveStatus('idle')
    startPaymentTransition(async () => {
      const result = await updatePaymentProvider(paymentProvider)
      if (result.error) {
        setPaymentSaveStatus('error')
        setPaymentSaveError(result.error)
      } else {
        setPaymentSaveStatus('success')
      }
    })
  }

  // Telegram verification flow
  const [telegramCodeGenerated, setTelegramCodeGenerated] = useState<string | null>(null)
  const [telegramVerifyError, setTelegramVerifyError] = useState('')
  const [isTelegramSendPending, startTelegramSendTransition] = useTransition()
  const [copySuccess, setCopySuccess] = useState(false)

  function handleGetTelegramCode() {
    setTelegramVerifyError('')
    startTelegramSendTransition(async () => {
      const result = await sendTelegramVerificationCode()
      if ('error' in result && result.error) {
        setTelegramVerifyError(result.error)
      } else if ('code' in result && result.code) {
        setTelegramCodeGenerated(result.code)
      }
    })
  }

  function handleCopyVerifyCommand() {
    if (!telegramCodeGenerated) return
    navigator.clipboard.writeText(`/verify ${telegramCodeGenerated}`)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  // Email change flow
  const [emailChangeMode, setEmailChangeMode] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailChangeSent, setEmailChangeSent] = useState(false)
  const [emailChangePendingAddress, setEmailChangePendingAddress] = useState('')
  const [emailChangeError, setEmailChangeError] = useState('')

  // Save state
  const [isPending, startTransition] = useTransition()
  const [isEmailPending, startEmailTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })

  const roleLabel =
    user.role === 'system_admin'
      ? 'System Admin'
      : user.role === 'event_promoter'
        ? 'Event Promoter'
        : 'User'

  const ageVerInfo = {
    unverified: { label: 'Unverified', bg: '#F3F4F6', color: '#6B7280' },
    pending: { label: 'Pending', bg: 'var(--sd-amber-light)', color: '#92400e' },
    verified: { label: 'Verified', bg: 'var(--sd-green-light)', color: 'var(--sd-green-dark)' },
    failed: { label: 'Failed', bg: 'var(--sd-red-light)', color: 'var(--sd-red)' },
  }[user.age_verification_status] || { label: 'Unverified', bg: '#F3F4F6', color: '#6B7280' }

  // Other scene names tag management
  function addName() {
    const trimmed = nameInput.trim()
    if (trimmed && !otherNames.includes(trimmed)) {
      setOtherNames([...otherNames, trimmed])
    }
    setNameInput('')
  }

  function removeName(name: string) {
    setOtherNames(otherNames.filter(n => n !== name))
  }

  // Social media management
  function updateSocialValue(index: number, value: string) {
    setSocials(prev => prev.map((s, i) => (i === index ? { ...s, value } : s)))
  }

  function clearSocial(index: number, isCustom: boolean) {
    if (isCustom) {
      setSocials(prev => prev.filter((_, i) => i !== index))
    } else {
      updateSocialValue(index, '')
    }
  }

  function addCustomLink() {
    if (!customKeyInput.trim()) return
    setSocials(prev => [...prev, { key: customKeyInput.trim(), value: '', isCustom: true }])
    setCustomKeyInput('')
  }

  // Save handler
  function handleSave() {
    setSaveStatus('idle')
    startTransition(async () => {
      const result = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        preferred_scene_name: preferredName,
        other_scene_names: otherNames,
        phone,
        zip_code: zipCode,
        emergency_contact: emergencyContact,
        emergency_phone: emergencyPhone,
        social_media: socials.filter(s => s.value.trim()),
        telegram_handle: telegramHandle,
        roommate_finder_hidden: roommateHidden,
        email_notifications_enabled: emailNotifs,
        telegram_notifications_enabled: telegramNotifs,
      })
      if (result.error) {
        setSaveStatus('error')
        setSaveError(result.error)
      } else {
        setSaveStatus('success')
      }
    })
  }

  // Email change handler
  function handleEmailChange() {
    setEmailChangeError('')
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailChangeError('Please enter a valid email address.')
      return
    }
    startEmailTransition(async () => {
      const result = await requestEmailChange(newEmail)
      if (result.error) {
        setEmailChangeError(result.error)
      } else {
        setEmailChangePendingAddress(newEmail)
        setEmailChangeSent(true)
        setEmailChangeMode(false)
        setNewEmail('')
      }
    })
  }

  // Compute incomplete-profile warnings.
  // These items are required before the user can enroll in any event.
  const warnings: { key: string; message: string; action: SectionKey }[] = []
  if (!user.first_name || !user.last_name) {
    warnings.push({
      key: 'name',
      message: 'Please add your first and last name to sign up for events.',
      action: 'contact',
    })
  }
  if (!user.emergency_contact || !user.emergency_phone) {
    warnings.push({
      key: 'emergency',
      message: 'Please add an emergency contact name and phone number to sign up for events.',
      action: 'contact',
    })
  }
  if (!user.telegram_verified) {
    warnings.push({
      key: 'telegram',
      message: user.telegram_handle
        ? 'Verify your Telegram handle to receive event notifications.'
        : 'Add and verify your Telegram handle to receive event notifications.',
      action: 'telegram',
    })
  }

  function toggleSection(key: SectionKey) {
    setOpenSection(prev => (prev === key ? null : key))
  }

  const sectionHeaderBtn = (key: SectionKey, label: string) => (
    <button
      onClick={() => toggleSection(key)}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        background: openSection === key ? 'var(--sd-card)' : '#fff',
        border: '1px solid var(--sd-border)',
        borderRadius: openSection === key ? 'var(--sd-radius) var(--sd-radius) 0 0' : 'var(--sd-radius)',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 600,
        color: 'var(--sd-text)',
        textAlign: 'left',
      }}
    >
      {label}
      <span style={{ fontSize: '18px', color: 'var(--sd-muted)', transform: openSection === key ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
        &#9662;
      </span>
    </button>
  )

  const sectionBody = (key: SectionKey, children: React.ReactNode) => {
    if (openSection !== key) return null
    return (
      <div
        style={{
          padding: '20px',
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderTop: 'none',
          borderRadius: '0 0 var(--sd-radius) var(--sd-radius)',
        }}
      >
        {children}
      </div>
    )
  }

  const visibleSections = SECTIONS.filter(s => !s.epOnly || isEpOrAdmin)

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Header with avatar and account info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--sd-green)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--sd-text)' }}>
            {displayName}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
            {roleLabel} &middot; Member since {memberSince}
          </div>
        </div>
      </div>

      {/* Incomplete profile warnings */}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {warnings.map(w => (
            <button
              key={w.key}
              onClick={() => setOpenSection(w.action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--sd-radius)',
                border: '1px solid #FCD34D',
                background: 'var(--sd-amber-light)',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '13px',
                color: '#92400e',
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>!</span>
              <span>{w.message}</span>
            </button>
          ))}
        </div>
      )}

      {/* Accordion sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* Display Name & Photo */}
        {visibleSections.some(s => s.key === 'profile') && (
          <div>
            {sectionHeaderBtn('profile', 'Display Name & Photo')}
            {sectionBody('profile', (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'var(--sd-green)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <button
                      disabled
                      style={{
                        padding: '6px 12px',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'not-allowed',
                        border: '1px solid var(--sd-border)',
                        background: '#fff',
                        color: 'var(--sd-text)',
                        opacity: 0.6,
                      }}
                    >
                      Change photo
                    </button>
                    <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px' }}>Coming soon</p>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                    Preferred scene name
                  </label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={preferredName}
                    onChange={e => setPreferredName(e.target.value)}
                    placeholder="Your scene name..."
                  />
                  <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '3px' }}>
                    Shown in Roommate Finder, badges, and notifications. Leave blank to use your email username.
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                    Other scene names{' '}
                    <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {otherNames.map(name => (
                      <span
                        key={name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: 'var(--sd-card2)',
                          border: '1px solid var(--sd-border)',
                          borderRadius: '99px',
                          fontSize: '13px',
                        }}
                      >
                        {name}
                        <button
                          onClick={() => removeName(name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--sd-xs)',
                            fontSize: '16px',
                            lineHeight: 1,
                            padding: 0,
                          }}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    <input
                      style={{ ...inputStyle, width: '140px' }}
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Tab') {
                          e.preventDefault()
                          addName()
                        }
                      }}
                      placeholder="Add a name..."
                    />
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                    For Event Promoter reference only. Never shown publicly. Press Enter to add.
                  </p>
                </div>
              </>
            ))}
          </div>
        )}

        {/* Contact Info */}
        <div>
          {sectionHeaderBtn('contact', 'Contact Info')}
          {sectionBody('contact', (
            <>
              {/* First + Last Name */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '7px',
                  border: (!user.first_name || !user.last_name) ? '1px solid #FCD34D' : '1px solid var(--sd-border)',
                  background: (!user.first_name || !user.last_name) ? 'var(--sd-amber-light)' : 'var(--sd-card2)',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: (!user.first_name || !user.last_name) ? '#92400e' : 'var(--sd-text)' }}>
                  Legal Name
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                      First name
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                      Last name
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                  Email address
                </label>
                {!emailChangeMode && !emailChangeSent && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      style={{ ...inputStyle, background: 'var(--sd-card2)', color: 'var(--sd-muted)' }}
                      type="email"
                      value={user.email}
                      readOnly
                    />
                    <button
                      onClick={() => setEmailChangeMode(true)}
                      style={{
                        whiteSpace: 'nowrap',
                        padding: '8px 14px',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: '1px solid var(--sd-border)',
                        background: '#fff',
                        color: 'var(--sd-text)',
                      }}
                    >
                      Change email
                    </button>
                  </div>
                )}
                {emailChangeMode && (
                  <div>
                    <input
                      style={{ ...inputStyle, background: 'var(--sd-card2)', color: 'var(--sd-muted)', marginBottom: '8px' }}
                      type="email"
                      value={user.email}
                      readOnly
                    />
                    <input
                      style={{ ...inputStyle, marginBottom: '8px' }}
                      type="email"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="New email address"
                      autoFocus
                    />
                    {emailChangeError && (
                      <p style={{ fontSize: '13px', color: 'var(--sd-red)', marginBottom: '8px' }}>
                        {emailChangeError}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handleEmailChange}
                        disabled={isEmailPending}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '7px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: isEmailPending ? 'not-allowed' : 'pointer',
                          border: 'none',
                          background: isEmailPending ? 'var(--sd-muted)' : 'var(--sd-green)',
                          color: '#fff',
                        }}
                      >
                        {isEmailPending ? 'Sending...' : 'Send verification'}
                      </button>
                      <button
                        onClick={() => { setEmailChangeMode(false); setNewEmail(''); setEmailChangeError('') }}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '7px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          border: '1px solid var(--sd-border)',
                          background: '#fff',
                          color: 'var(--sd-text)',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {emailChangeSent && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '7px',
                      fontSize: '13px',
                      border: '1px solid #FCD34D',
                      background: 'var(--sd-amber-light)',
                      color: '#92400e',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>Email change in progress</div>
                    Verification email sent to <strong>{emailChangePendingAddress}</strong>. Check your inbox
                    and click the link to confirm. You will be logged out after confirming.
                    <div style={{ marginTop: '8px' }}>
                      <button
                        onClick={() => { setEmailChangeSent(false); setEmailChangePendingAddress('') }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#92400e',
                          fontSize: '12px',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        Cancel email change
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Phone + Zip */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                    Phone <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    style={inputStyle}
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="555-867-5309"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                    Zip code <span style={{ color: 'var(--sd-muted)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    style={inputStyle}
                    type="text"
                    value={zipCode}
                    onChange={e => setZipCode(e.target.value)}
                    placeholder="97201"
                  />
                </div>
              </div>

              {/* Emergency Contact */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '7px',
                  border: (!emergencyContact || !emergencyPhone) ? '1px solid #FCD34D' : '1px solid var(--sd-border)',
                  background: (!emergencyContact || !emergencyPhone) ? 'var(--sd-amber-light)' : 'var(--sd-card2)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: (!emergencyContact || !emergencyPhone) ? '#92400e' : 'var(--sd-text)' }}>
                  Emergency Contact
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                      Name
                    </label>
                    <input
                      style={inputStyle}
                      type="text"
                      value={emergencyContact}
                      onChange={e => setEmergencyContact(e.target.value)}
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                      Phone
                    </label>
                    <input
                      style={inputStyle}
                      type="tel"
                      value={emergencyPhone}
                      onChange={e => setEmergencyPhone(e.target.value)}
                      placeholder="555-867-5309"
                    />
                  </div>
                </div>
              </div>
            </>
          ))}
        </div>

        {/* Social Media */}
        <div>
          {sectionHeaderBtn('social', 'Social Media')}
          {sectionBody('social', (
            <>
              {socials.map((social, i) => (
                <div
                  key={`${social.key}-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 1fr 32px',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  {social.isCustom ? (
                    <input
                      style={{ ...inputStyle, fontSize: '13px', padding: '7px 10px' }}
                      type="text"
                      value={social.key}
                      onChange={e => setSocials(prev => prev.map((s, j) => j === i ? { ...s, key: e.target.value } : s))}
                      placeholder="Platform name"
                    />
                  ) : (
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sd-muted)' }}>
                      {social.key}
                    </span>
                  )}
                  <input
                    style={inputStyle}
                    type="text"
                    value={social.value}
                    onChange={e => updateSocialValue(i, e.target.value)}
                    placeholder="username"
                  />
                  <button
                    onClick={() => clearSocial(i, social.isCustom)}
                    title={social.isCustom ? 'Remove' : 'Clear'}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid var(--sd-border)',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: 'var(--sd-muted)',
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, width: '160px' }}
                  type="text"
                  value={customKeyInput}
                  onChange={e => setCustomKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomLink()}
                  placeholder="Custom platform..."
                />
                <button
                  onClick={addCustomLink}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: '1px solid var(--sd-border)',
                    background: '#fff',
                    color: 'var(--sd-text)',
                  }}
                >
                  + Add custom link
                </button>
              </div>
            </>
          ))}
        </div>

        {/* Telegram */}
        <div>
          {sectionHeaderBtn('telegram', 'Telegram')}
          {sectionBody('telegram', (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
                  Telegram handle
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    type="text"
                    value={telegramHandle}
                    onChange={e => setTelegramHandle(e.target.value)}
                    placeholder="yourusername"
                  />
                  {user.telegram_verified ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: 'var(--sd-green-light)',
                        color: 'var(--sd-green-dark)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Verified
                    </span>
                  ) : telegramHandle ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 500,
                        background: 'var(--sd-amber-light)',
                        color: '#92400e',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Unverified
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '3px' }}>
                  Stored without @. The platform uses this to send you Telegram notifications.
                </p>
              </div>
              {telegramHandle && !user.telegram_verified && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    border: '1px solid #FCD34D',
                    background: 'var(--sd-amber-light)',
                    color: '#92400e',
                  }}
                >
                  {!telegramCodeGenerated ? (
                    <>
                      <strong>Handle not yet verified.</strong> Get a verification code to send to the bot.{' '}
                      <button
                        onClick={handleGetTelegramCode}
                        disabled={isTelegramSendPending}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: isTelegramSendPending ? 'not-allowed' : 'pointer',
                          color: '#92400e',
                          fontSize: '13px',
                          textDecoration: 'underline',
                          padding: 0,
                        }}
                      >
                        {isTelegramSendPending ? 'Generating...' : 'Get verification code'}
                      </button>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        Your code: <strong style={{ fontSize: '16px', letterSpacing: '2px' }}>{telegramCodeGenerated}</strong>
                        <button
                          onClick={handleCopyVerifyCommand}
                          style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            border: '1px solid #92400e',
                            background: 'none',
                            color: '#92400e',
                            cursor: 'pointer',
                          }}
                        >
                          {copySuccess ? 'Copied!' : 'Copy /verify command'}
                        </button>
                      </div>
                      <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <li>Open <strong>@ShinyDogEventsBot</strong> on Telegram</li>
                        <li>Send exactly: <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: '3px' }}>/verify {telegramCodeGenerated}</code></li>
                        <li>
                          <button
                            onClick={() => router.refresh()}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#92400e',
                              fontSize: '12px',
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                          >
                            Refresh status
                          </button>{' '}
                          after sending to confirm
                        </li>
                      </ol>
                      <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        Code expires in 15 minutes.{' '}
                        <button
                          onClick={handleGetTelegramCode}
                          disabled={isTelegramSendPending}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#92400e',
                            fontSize: '11px',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                          }}
                        >
                          Get a new code
                        </button>
                      </div>
                    </div>
                  )}
                  {telegramVerifyError && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#991b1b' }}>
                      {telegramVerifyError}
                    </div>
                  )}
                </div>
              )}
            </>
          ))}
        </div>

        {/* Privacy */}
        <div>
          {sectionHeaderBtn('privacy', 'Privacy')}
          {sectionBody('privacy', (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500 }}>Hide my name in Roommate Finder</div>
                <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                  When enabled, your scene name appears as &ldquo;Anonymous&rdquo; in all Roommate Finder views
                  across all events.
                </div>
              </div>
              <Toggle checked={roommateHidden} onChange={setRoommateHidden} />
            </div>
          ))}
        </div>

        {/* Notifications */}
        <div>
          {sectionHeaderBtn('notifications', 'Notifications')}
          {sectionBody('notifications', (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--sd-border-light)',
                  marginBottom: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>Email notifications</div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                    Receive event updates and alerts by email.
                  </div>
                </div>
                <Toggle checked={emailNotifs} onChange={setEmailNotifs} />
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>Telegram notifications</div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '2px' }}>
                    Receive real-time notifications via Telegram. Requires verified handle.
                  </div>
                </div>
                <Toggle
                  checked={telegramNotifs}
                  onChange={setTelegramNotifs}
                  disabled={!user.telegram_verified}
                />
              </div>
            </>
          ))}
        </div>

        {/* Age Verification */}
        <div>
          {sectionHeaderBtn('age', 'Age Verification')}
          {sectionBody('age', (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500, fontSize: '14px' }}>Online verification status:</span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: ageVerInfo.bg,
                      color: ageVerInfo.color,
                    }}
                  >
                    {ageVerInfo.label}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
                  Online age verification is optional. You will always be verified in-person at check-in.
                </p>
              </div>
              <button
                disabled
                title="Age verification coming soon"
                style={{
                  padding: '8px 14px',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'not-allowed',
                  border: '1px solid var(--sd-border)',
                  background: '#fff',
                  color: 'var(--sd-text)',
                  opacity: 0.5,
                  whiteSpace: 'nowrap',
                }}
              >
                Verify online
              </button>
            </div>
          ))}
        </div>

        {/* Payment Settings — EP / admin only */}
        {isEpOrAdmin && (
          <div>
            {sectionHeaderBtn('payment', 'Payment Settings')}
            {sectionBody('payment', (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '10px' }}>
                    Active Payment Processor
                  </label>
                  {(['square', 'paypal'] as const).map(p => (
                    <label
                      key={p}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '10px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
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
                  <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
                    Applies to all events you manage.
                  </p>
                </div>
                {paymentSaveStatus === 'success' && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '7px',
                      fontSize: '13px',
                      border: '1px solid #6EE7B7',
                      background: 'var(--sd-green-light)',
                      color: 'var(--sd-green-dark)',
                      marginBottom: '10px',
                    }}
                  >
                    Payment settings saved.
                  </div>
                )}
                {paymentSaveStatus === 'error' && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: '7px',
                      fontSize: '13px',
                      border: '1px solid #FCA5A5',
                      background: 'var(--sd-red-light)',
                      color: '#991b1b',
                      marginBottom: '10px',
                    }}
                  >
                    {paymentSaveError || 'Something went wrong. Please try again.'}
                  </div>
                )}
                <button
                  onClick={handlePaymentSave}
                  disabled={isPaymentPending}
                  style={{
                    padding: '9px 20px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: isPaymentPending ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: isPaymentPending ? 'var(--sd-muted)' : 'var(--sd-green)',
                    color: '#fff',
                  }}
                >
                  {isPaymentPending ? 'Saving...' : 'Save Payment Settings'}
                </button>
              </>
            ))}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div style={{ marginTop: '24px' }}>
        {saveStatus === 'success' && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              border: '1px solid #6EE7B7',
              background: 'var(--sd-green-light)',
              color: 'var(--sd-green-dark)',
              marginBottom: '12px',
            }}
          >
            Profile saved successfully.
          </div>
        )}
        {saveStatus === 'error' && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              border: '1px solid #FCA5A5',
              background: 'var(--sd-red-light)',
              color: '#991b1b',
              marginBottom: '12px',
            }}
          >
            {saveError || 'Something went wrong. Please try again.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: '10px 24px',
              borderRadius: '7px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: isPending ? 'not-allowed' : 'pointer',
              border: 'none',
              background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)',
              color: '#fff',
            }}
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>

          {/* Danger zone inline */}
          <button
            disabled
            style={{
              marginLeft: 'auto',
              padding: '8px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'not-allowed',
              border: '1px solid #FCA5A5',
              background: '#fff',
              color: 'var(--sd-red)',
              opacity: 0.6,
            }}
          >
            Delete account
          </button>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '4px', textAlign: 'right' }}>
          Contact support to delete your account.
        </p>
      </div>
    </div>
  )
}
