import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { dismissNotification, dismissAllNotifications } from './actions'

interface PlatformNotification {
  id: string
  notification_type: string
  title: string
  body: string
  action_url: string | null
  action_label: string | null
  event_id: string | null
  is_read: boolean
  dismissed_at: string | null
  created_at: string
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('platform_notifications')
    .select('id, notification_type, title, body, action_url, action_label, event_id, is_read, dismissed_at, created_at')
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const list = (notifications ?? []) as PlatformNotification[]
  const unreadCount = list.filter(n => !n.is_read).length

  // Mark all visible notifications as read on page load.
  // Done via direct DB call (not a Server Action) to avoid triggering revalidatePath during render.
  if (unreadCount > 0) {
    await supabase
      .from('platform_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .is('dismissed_at', null)
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>
          Notifications
          {unreadCount > 0 && (
            <span style={{
              marginLeft: '10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'var(--sd-red)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '999px',
              verticalAlign: 'middle',
            }}>
              {unreadCount} new
            </span>
          )}
        </h1>

        {list.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <form action={dismissAllNotifications}>
              <button type="submit" style={{
                background: 'none',
                border: '1px solid var(--sd-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--sd-muted)',
                cursor: 'pointer',
              }}>
                Dismiss all
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <div style={{
          background: 'var(--sd-card)',
          border: '1px solid var(--sd-border)',
          borderRadius: 'var(--sd-radius)',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--sd-muted)', margin: 0 }}>
            No notifications yet.
          </p>
        </div>
      )}

      {/* Notification list */}
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {list.map((n, idx) => (
            <div
              key={n.id}
              style={{
                background: n.is_read ? 'var(--sd-card)' : 'var(--sd-blue-light, #eff6ff)',
                border: '1px solid var(--sd-border)',
                borderRadius: idx === 0 ? 'var(--sd-radius) var(--sd-radius) 0 0' : idx === list.length - 1 ? '0 0 var(--sd-radius) var(--sd-radius)' : '0',
                padding: '14px 16px',
                borderLeft: n.is_read ? '1px solid var(--sd-border)' : '3px solid var(--sd-green)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: n.is_read ? 500 : 700,
                    color: 'var(--sd-text)',
                  }}>
                    {n.title}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--sd-muted)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(n.created_at)}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--sd-muted)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                  {n.body}
                </p>
                {n.action_url && n.action_label && (
                  <a
                    href={n.action_url}
                    style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--sd-green)',
                      textDecoration: 'none',
                      border: '1px solid var(--sd-green)',
                      borderRadius: '5px',
                      padding: '4px 10px',
                    }}
                  >
                    {n.action_label} →
                  </a>
                )}
              </div>

              {/* Dismiss */}
              <form action={dismissNotification.bind(null, n.id)}>
                <button
                  type="submit"
                  title="Dismiss"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--sd-muted)',
                    fontSize: '16px',
                    lineHeight: 1,
                    padding: '2px 4px',
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
