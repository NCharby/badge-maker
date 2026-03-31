'use client'

import { useState, useTransition } from 'react'
import { updateEventTelegramConfig, TelegramNotificationConfig } from './actions'

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

const cardStyle: React.CSSProperties = {
  background: 'var(--sd-card)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  padding: '24px',
  marginBottom: '20px',
  boxShadow: '0 1px 3px rgba(0,0,0,.06)',
}

const NOTIFICATION_TYPES = [
  {
    key: 'status_transition' as const,
    label: 'Event Status Transition',
    description: 'Fires when the EP advances the event to any status.',
    defaultTemplate: '📢 {event_name} update: {new_status}',
    variables: ['{event_name}', '{new_status}', '{event_url}', '{status_message}'],
  },
  {
    key: 'new_attendee_enrolled' as const,
    label: 'New Attendee Enrolled',
    description: 'Fires when a user completes their first enrollment action (application or ticket purchase). "Send DM to user" notifies the new attendee directly.',
    defaultTemplate: '👋 Welcome to {event_name}, {scene_name}!',
    variables: ['{event_name}', '{scene_name}', '{event_url}'],
  },
  {
    key: 'lock_deadline_1week' as const,
    label: 'Lock-In Deadline — 1 Week',
    description: 'Fires 1 week before the Room Lock-In Date.',
    defaultTemplate: '⏰ Room lock-in for {event_name} is in 1 week.',
    variables: ['{event_name}', '{lock_in_date}', '{event_url}'],
  },
  {
    key: 'lock_deadline_48h' as const,
    label: 'Lock-In Deadline — 48 Hours',
    description: 'Fires 48 hours before the Room Lock-In Date.',
    defaultTemplate: '⚠️ URGENT: Room lock-in for {event_name} is in 48 hours!',
    variables: ['{event_name}', '{lock_in_date}', '{event_url}'],
  },
  {
    key: 'event_locked' as const,
    label: 'Event Locked',
    description: 'Fires when the event transitions to "Event Locked" status.',
    defaultTemplate: '🔒 {event_name} is now locked. See you there!',
    variables: ['{event_name}', '{event_date}', '{event_url}'],
  },
] as const

type NotificationKey = typeof NOTIFICATION_TYPES[number]['key']

type TypeState = {
  send_to_channel: boolean
  send_to_user: boolean
  message_template: string
}

function buildInitialTypeState(
  key: NotificationKey,
  savedConfig: TelegramNotificationConfig | null,
): TypeState {
  const saved = savedConfig?.[key] as any // may have old "enabled" field from prior schema
  return {
    send_to_channel: saved?.send_to_channel ?? saved?.enabled ?? true,
    send_to_user: saved?.send_to_user ?? false,
    message_template: saved?.message_template ?? '',
  }
}

const LOCK_COUNTDOWN_KEYS = new Set<NotificationKey>(['lock_deadline_1week', 'lock_deadline_48h'])

function formatLockInDate(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return ts
  }
}

function validateChatLink(raw: string): 'valid' | 'invalid' | 'empty' {
  const trimmed = raw.trim()
  if (!trimmed) return 'empty'
  try {
    const u = new URL(trimmed)
    if (u.hostname === 't.me') return 'valid'
    return 'invalid'
  } catch {
    return 'invalid'
  }
}

// Parse a public Telegram channel invite link (e.g. https://t.me/myeventchannel) → @myeventchannel
// Also accepts already-formatted @usernames or numeric chat IDs unchanged.
function parseChannelInput(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('@') || /^-?\d+$/.test(trimmed)) return trimmed
  // Public channel link: t.me/username (no + prefix)
  const m = trimmed.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{5,32})$/)
  if (m) return '@' + m[1]
  return trimmed
}

function SmallToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '36px',
        height: '20px',
        flexShrink: 0,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '20px',
          background: checked ? 'var(--sd-green)' : '#D1D5DB',
          transition: 'background 0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '14px',
            height: '14px',
            left: checked ? '19px' : '3px',
            top: '3px',
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </label>
  )
}

export default function NotificationsClient({
  eventId,
  botUsername,
  initialTelegramGroup,
  initialTelegramChatLink,
  initialConfig,
  roomLockInDate,
}: {
  eventId: string
  botUsername: string | null
  initialTelegramGroup: string | null
  initialTelegramChatLink: string | null
  initialConfig: TelegramNotificationConfig | null
  roomLockInDate: string | null
}) {
  const [channelInput, setChannelInput] = useState(initialTelegramGroup ?? '')
  const [chatLinkInput, setChatLinkInput] = useState(initialTelegramChatLink ?? '')
  const [typeStates, setTypeStates] = useState<Record<NotificationKey, TypeState>>(() => {
    const result = {} as Record<NotificationKey, TypeState>
    for (const t of NOTIFICATION_TYPES) {
      result[t.key] = buildInitialTypeState(t.key, initialConfig)
    }
    return result
  })

  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const parsedChannel = parseChannelInput(channelInput)

  function setTypeField(key: NotificationKey, field: keyof TypeState, value: boolean | string) {
    setTypeStates(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  function handleSave() {
    setSaveStatus('idle')
    startTransition(async () => {
      const config: TelegramNotificationConfig = {}
      for (const t of NOTIFICATION_TYPES) {
        config[t.key] = typeStates[t.key]
      }
      const result = await updateEventTelegramConfig(eventId, parsedChannel, chatLinkInput, config)
      if (result.error) {
        setSaveStatus('error')
        setSaveError(result.error)
      } else {
        setSaveStatus('success')
      }
    })
  }

  return (
    <div>
      {/* Section 1: Telegram Setup */}
      <div style={cardStyle}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Telegram Setup</div>

        {/* Field 1: Bot (read-only) */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Notification bot
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '8px 12px',
              background: 'var(--sd-bg)',
              border: '1px solid var(--sd-border)',
              borderRadius: '7px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--sd-text)',
              letterSpacing: '0.01em',
              minWidth: '180px',
            }}
          >
            {botUsername ?? 'Bot not configured'}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '6px' }}>
            This bot sends direct messages to your attendees and posts announcements to your channel.
            Attendees message this bot to verify their Telegram account.
          </p>
        </div>

        {/* Field 2: Channel link (editable) */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Channel invite link <span style={{ fontWeight: 400, color: 'var(--sd-muted)' }}>(optional)</span>
          </label>
          <input
            style={{ ...inputStyle, maxWidth: '360px' }}
            type="text"
            value={channelInput}
            onChange={e => { setChannelInput(e.target.value); setSaveStatus('idle') }}
            placeholder="https://t.me/myeventchannel"
          />
          {channelInput.trim() && (
            <p style={{
              fontSize: '12px',
              marginTop: '4px',
              color: parsedChannel.startsWith('@') || /^-?\d+$/.test(parsedChannel)
                ? 'var(--sd-green-dark)'
                : '#b45309',
            }}>
              {parsedChannel.startsWith('@') || /^-?\d+$/.test(parsedChannel)
                ? `Channel resolved to: ${parsedChannel}`
                : 'Could not parse a channel username from this link. Make sure it is a public channel link (no + in the URL).'}
            </p>
          )}
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
            Paste the invite link for your public Telegram channel (e.g. <code>https://t.me/myeventchannel</code>).
            Leave blank to send to users only.
          </p>
        </div>

        {/* Field 3: Group Chat Link */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '5px' }}>
            Group Chat Link <span style={{ fontWeight: 400, color: 'var(--sd-muted)' }}>(optional)</span>
          </label>
          <input
            style={{ ...inputStyle, maxWidth: '360px' }}
            type="text"
            value={chatLinkInput}
            onChange={e => { setChatLinkInput(e.target.value); setSaveStatus('idle') }}
            placeholder="https://t.me/joinchat/..."
          />
          {chatLinkInput.trim() && (
            <p style={{
              fontSize: '12px',
              marginTop: '4px',
              color: validateChatLink(chatLinkInput) === 'valid' ? 'var(--sd-green-dark)' : '#b45309',
            }}>
              {validateChatLink(chatLinkInput) === 'valid'
                ? 'Valid Telegram link.'
                : 'This doesn\'t look like a Telegram link (expected https://t.me/…).'}
            </p>
          )}
          <p style={{ fontSize: '12px', color: 'var(--sd-muted)', marginTop: '4px' }}>
            The general group chat where all attendees can chat and share. Shown to attendees as a &ldquo;Telegram Group&rdquo; button on the event page.
          </p>
        </div>

        {/* Setup instruction callout */}
        {botUsername && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '7px',
              fontSize: '12px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              color: '#1e40af',
            }}
          >
            <strong>Before posting to a channel:</strong> open the channel on Telegram →
            Manage Channel → Administrators → Add Administrator → search for{' '}
            <strong>{botUsername}</strong> → grant <strong>Post Messages</strong> permission.
          </div>
        )}
      </div>

      {/* Section 2: Notification Type Settings */}
      <div style={cardStyle}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Notification Settings</div>
        <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px' }}>
          Configure where each notification is delivered. Leave the message blank to use the default template.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {NOTIFICATION_TYPES.map(t => {
            const state = typeStates[t.key]
            const active = state.send_to_channel || state.send_to_user
            return (
              <div
                key={t.key}
                style={{
                  borderTop: '1px solid var(--sd-border-light)',
                  paddingTop: '20px',
                }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{t.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '6px' }}>{t.description}</div>
                  {LOCK_COUNTDOWN_KEYS.has(t.key) && (
                    roomLockInDate ? (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: '#F0FDF4',
                        border: '1px solid #86EFAC',
                        fontSize: '12px',
                        color: '#166534',
                        marginBottom: '8px',
                      }}>
                        <span style={{ fontWeight: 600 }}>Lock-In Date:</span> {formatLockInDate(roomLockInDate)}
                      </div>
                    ) : (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'var(--sd-amber-light)',
                        border: '1px solid #FCD34D',
                        fontSize: '12px',
                        color: '#92400e',
                        marginBottom: '8px',
                      }}>
                        No Lock-In Date set — go to{' '}
                        <a href="settings" style={{ color: '#92400e', fontWeight: 600 }}>Event Settings</a>{' '}
                        to enable this notification.
                      </div>
                    )
                  )}

                  {/* Delivery toggles */}
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <SmallToggle
                        checked={state.send_to_channel}
                        onChange={v => setTypeField(t.key, 'send_to_channel', v)}
                      />
                      Post to channel
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <SmallToggle
                        checked={state.send_to_user}
                        onChange={v => setTypeField(t.key, 'send_to_user', v)}
                      />
                      Send DM to user
                    </label>
                  </div>
                </div>

                <div style={{ opacity: active ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>
                    Custom message
                  </label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: '60px',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                    value={state.message_template}
                    onChange={e => setTypeField(t.key, 'message_template', e.target.value)}
                    placeholder={t.defaultTemplate}
                    disabled={!active}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--sd-muted)', marginTop: '3px' }}>
                    Available variables: {t.variables.map(v => (
                      <code
                        key={v}
                        style={{
                          background: 'var(--sd-bg)',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          marginRight: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{
            padding: '10px 20px',
            borderRadius: '7px',
            fontSize: '14px',
            fontWeight: 500,
            border: 'none',
            background: isPending ? '#D1D5DB' : 'var(--sd-purple)',
            color: '#fff',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          {isPending ? 'Saving…' : 'Save notification settings'}
        </button>
        {saveStatus === 'success' && (
          <span style={{ fontSize: '13px', color: 'var(--sd-green-dark)' }}>Saved.</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: '13px', color: 'var(--sd-red)' }}>{saveError}</span>
        )}
      </div>
    </div>
  )
}
