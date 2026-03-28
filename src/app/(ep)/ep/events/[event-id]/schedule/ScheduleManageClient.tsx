'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createActivity, updateActivity, deleteActivity, importScheduleCSV } from './actions'
import type { ActivityInput } from './actions'
import CSVImportPanel from '@/components/ep/CSVImportPanel'

export type ActivityRow = {
  id: string
  name: string
  date_time: string
  duration_minutes: number
  description: string
  volunteers_requested: boolean
  volunteer_count: number | null
  volunteer_shift_duration_minutes: number | null
  volunteer_shift_date_time: string | null
}

const EMPTY_FORM: ActivityInput = {
  name: '',
  date_time: '',
  duration_minutes: '',
  description: '',
  volunteers_requested: false,
  volunteer_count: '',
  volunteer_shift_duration_minutes: '',
  volunteer_shift_date_time: '',
}

function toDatetimeLocal(isoStr: string): string {
  // Convert ISO timestamp to datetime-local input format
  return isoStr ? isoStr.slice(0, 16) : ''
}

function formatShiftTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: 'var(--sd-card)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

interface Props {
  eventId: string
  initialActivities: ActivityRow[]
}

function ActivityForm({
  eventId,
  initial,
  onSave,
  onCancel,
}: {
  eventId: string
  initial: ActivityInput & { id?: string }
  onSave: (activity: ActivityRow) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ActivityInput>(initial)
  const [error, setError] = useState('')
  const [shiftDateWarning, setShiftDateWarning] = useState(false)
  const [isPending, startTransition] = useTransition()

  function set(key: keyof ActivityInput, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleVolunteersToggle(checked: boolean) {
    setForm(prev => ({
      ...prev,
      volunteers_requested: checked,
      // Auto-populate shift date/time from activity date/time when first enabling
      volunteer_shift_date_time: checked && !prev.volunteer_shift_date_time
        ? prev.date_time
        : prev.volunteer_shift_date_time,
    }))
  }

  function handleSave(force = false) {
    setError('')

    // Warn if volunteer shift date differs from activity date
    if (!force && form.volunteers_requested && form.volunteer_shift_date_time && form.date_time) {
      const activityDate = form.date_time.slice(0, 10)
      const shiftDate = form.volunteer_shift_date_time.slice(0, 10)
      if (activityDate !== shiftDate) {
        setShiftDateWarning(true)
        return
      }
    }
    setShiftDateWarning(false)

    startTransition(async () => {
      const result = initial.id
        ? await updateActivity(initial.id, eventId, form)
        : await createActivity(eventId, form)

      if ('error' in result) {
        setError(result.error)
      } else {
        // Build a provisional activity row for optimistic local update
        const row: ActivityRow = {
          id: initial.id ?? crypto.randomUUID(),
          name: form.name.trim(),
          date_time: form.date_time,
          duration_minutes: parseInt(form.duration_minutes || '0', 10),
          description: form.description.trim(),
          volunteers_requested: form.volunteers_requested,
          volunteer_count: form.volunteers_requested ? parseInt(form.volunteer_count || '0', 10) : null,
          volunteer_shift_duration_minutes: form.volunteers_requested ? parseInt(form.volunteer_shift_duration_minutes || '0', 10) : null,
          volunteer_shift_date_time: form.volunteers_requested ? (form.volunteer_shift_date_time || null) : null,
        }
        onSave(row)
      }
    })
  }

  return (
    <div style={{
      background: '#F9FAFB',
      border: '1px solid var(--sd-border)',
      borderRadius: 'var(--sd-radius)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Activity Name *</label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Opening Ceremony" />
        </div>
        <div>
          <label style={labelStyle}>Date & Time *</label>
          <input type="datetime-local" style={inputStyle} value={form.date_time} onChange={e => set('date_time', e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Duration (minutes) *</label>
          <input type="number" min="1" style={inputStyle} value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} placeholder="60" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description *</label>
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Brief description of the activity"
          />
        </div>
      </div>

      {/* Volunteer integration */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.volunteers_requested}
            onChange={e => handleVolunteersToggle(e.target.checked)}
            style={{ accentColor: 'var(--sd-purple)' }}
          />
          Open to volunteers
        </label>
      </div>

      {form.volunteers_requested && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', paddingLeft: '22px' }}>
          <div>
            <label style={labelStyle}>Volunteers needed *</label>
            <input type="number" min="1" style={inputStyle} value={form.volunteer_count} onChange={e => set('volunteer_count', e.target.value)} placeholder="2" />
          </div>
          <div>
            <label style={labelStyle}>Shift duration (min) *</label>
            <input type="number" min="1" style={inputStyle} value={form.volunteer_shift_duration_minutes} onChange={e => set('volunteer_shift_duration_minutes', e.target.value)} placeholder="60" />
          </div>
          <div>
            <label style={labelStyle}>Shift Start Date & Time</label>
            <input type="datetime-local" style={inputStyle} value={form.volunteer_shift_date_time} onChange={e => set('volunteer_shift_date_time', e.target.value)} />
          </div>
        </div>
      )}

      {shiftDateWarning && (
        <div style={{ background: '#FFFBEB', border: '1px solid #F59E0B', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: '#92400E' }}>
          <strong>Warning:</strong> The volunteer shift date differs from the activity date. Save anyway?
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={() => handleSave(true)}
              style={{ padding: '4px 12px', borderRadius: '5px', border: 'none', background: '#F59E0B', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Save anyway
            </button>
            <button
              onClick={() => setShiftDateWarning(false)}
              style={{ padding: '4px 12px', borderRadius: '5px', border: '1px solid #F59E0B', background: 'none', fontSize: '12px', color: '#92400E', cursor: 'pointer' }}
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '13px', color: 'var(--sd-muted)', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={() => handleSave()}
          disabled={isPending}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function ScheduleManageClient({ eventId, initialActivities }: Props) {
  const router = useRouter()
  const [activities, setActivities] = useState<ActivityRow[]>(initialActivities)
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [isDeletePending, startDeleteTransition] = useTransition()

  // Sync state when server refreshes data (e.g. after CSV import)
  useEffect(() => {
    setActivities(initialActivities)
  }, [initialActivities])

  function handleSave(saved: ActivityRow) {
    setActivities(prev => {
      const idx = prev.findIndex(a => a.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next.sort((a, b) => a.date_time.localeCompare(b.date_time))
      }
      return [...prev, saved].sort((a, b) => a.date_time.localeCompare(b.date_time))
    })
    setAddingNew(false)
    setEditingId(null)
  }

  function handleDelete(activityId: string) {
    setDeleteError(prev => ({ ...prev, [activityId]: '' }))
    setConfirmingDeleteId(null)
    startDeleteTransition(async () => {
      const result = await deleteActivity(activityId, eventId)
      if ('error' in result) {
        setDeleteError(prev => ({ ...prev, [activityId]: result.error }))
      } else {
        setActivities(prev => prev.filter(a => a.id !== activityId))
      }
    })
  }

  return (
    <div>
      {/* Add activity button + CSV import */}
      {!addingNew && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Activity
          </button>
          <CSVImportPanel
            templatePath="/templates/schedule-import-template.csv"
            templateLabel="Schedule Template"
            onImport={csvText => importScheduleCSV(eventId, csvText)}
            onSuccess={() => router.refresh()}
          />
        </div>
      )}

      {addingNew && (
        <div style={{ marginBottom: '16px' }}>
          <ActivityForm
            eventId={eventId}
            initial={EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => setAddingNew(false)}
          />
        </div>
      )}

      {/* Empty state */}
      {activities.length === 0 && !addingNew && (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>No activities yet. Add the first one above.</p>
      )}

      {/* Activity list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {activities.map(activity => (
          <div key={activity.id}>
            {editingId === activity.id ? (
              <ActivityForm
                eventId={eventId}
                initial={{
                  name: activity.name,
                  date_time: toDatetimeLocal(activity.date_time),
                  duration_minutes: String(activity.duration_minutes),
                  description: activity.description,
                  volunteers_requested: activity.volunteers_requested,
                  volunteer_count: activity.volunteer_count != null ? String(activity.volunteer_count) : '',
                  volunteer_shift_duration_minutes: activity.volunteer_shift_duration_minutes != null ? String(activity.volunteer_shift_duration_minutes) : '',
                  volunteer_shift_date_time: activity.volunteer_shift_date_time ? toDatetimeLocal(activity.volunteer_shift_date_time) : '',
                  id: activity.id,
                }}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div style={{
                background: 'var(--sd-card)',
                border: '1px solid var(--sd-border)',
                borderRadius: 'var(--sd-radius)',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
                      {activity.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span>{formatShiftTime(activity.date_time)}</span>
                      <span>·</span>
                      <span>{formatDuration(activity.duration_minutes)}</span>
                      {activity.volunteers_requested && activity.volunteer_count && (
                        <>
                          <span>·</span>
                          <span style={{ color: 'var(--sd-purple)', fontWeight: 600 }}>
                            {activity.volunteer_count} volunteer{activity.volunteer_count !== 1 ? 's' : ''} needed
                          </span>
                        </>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--sd-text)', margin: 0, lineHeight: 1.5 }}>{activity.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                    {confirmingDeleteId === activity.id ? (
                      <>
                        <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Delete this activity?</span>
                        <button
                          onClick={() => handleDelete(activity.id)}
                          disabled={isDeletePending}
                          style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 600 }}
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          style={{ fontSize: '12px', color: 'var(--sd-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(activity.id); setAddingNew(false); setConfirmingDeleteId(null) }}
                          style={{ fontSize: '12px', color: 'var(--sd-purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(activity.id)}
                          disabled={isDeletePending}
                          style={{ fontSize: '12px', color: '#dc2626', background: 'none', border: 'none', cursor: isDeletePending ? 'not-allowed' : 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {deleteError[activity.id] && (
                  <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', marginBottom: 0 }}>{deleteError[activity.id]}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
