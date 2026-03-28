'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createShift, updateShift, deleteShift, updateSignupStatus, toggleAreaLead, importVolunteerCSV } from './actions'
import type { ShiftInput } from './actions'
import CSVImportPanel from '@/components/ep/CSVImportPanel'

export type ResolvedSignup = {
  id: string
  user_id: string
  display_name: string
  status: string
  area_lead_label: boolean
}

export type ShiftWithSignups = {
  id: string
  name: string
  date_time: string
  duration_minutes: number
  capacity: number
  signups: ResolvedSignup[]
}

const EMPTY_SHIFT: ShiftInput = { name: '', date_time: '', duration_minutes: '', capacity: '' }

function toDatetimeLocal(isoStr: string): string {
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

function ShiftForm({
  eventId,
  initial,
  onSave,
  onCancel,
}: {
  eventId: string
  initial: ShiftInput & { id?: string }
  onSave: (shift: ShiftWithSignups) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<ShiftInput>(initial)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function set(key: keyof ShiftInput, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      const result = initial.id
        ? await updateShift(initial.id, eventId, form)
        : await createShift(eventId, form)

      if ('error' in result) {
        setError(result.error)
      } else {
        const row: ShiftWithSignups = {
          id: initial.id ?? crypto.randomUUID(),
          name: form.name.trim(),
          date_time: form.date_time,
          duration_minutes: parseInt(form.duration_minutes || '0', 10),
          capacity: parseInt(form.capacity || '0', 10),
          signups: [],
        }
        onSave(row)
      }
    })
  }

  return (
    <div style={{ background: '#F9FAFB', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
        <div style={{ gridColumn: '1 / 3' }}>
          <label style={labelStyle}>Shift Name *</label>
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Registration Desk" />
        </div>
        <div>
          <label style={labelStyle}>Duration (min) *</label>
          <input type="number" min="1" style={inputStyle} value={form.duration_minutes} onChange={e => set('duration_minutes', e.target.value)} placeholder="60" />
        </div>
        <div>
          <label style={labelStyle}>Capacity *</label>
          <input type="number" min="1" style={inputStyle} value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="5" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Date & Time *</label>
          <input type="datetime-local" style={inputStyle} value={form.date_time} onChange={e => set('date_time', e.target.value)} />
        </div>
      </div>

      {error && <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '13px', color: 'var(--sd-muted)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export default function VolunteerManageClient({ eventId, initialShifts }: {
  eventId: string
  initialShifts: ShiftWithSignups[]
}) {
  const router = useRouter()
  const [shifts, setShifts] = useState<ShiftWithSignups[]>(initialShifts)
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({})
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [isSignupPending, startSignupTransition] = useTransition()

  // Sync state when server refreshes data (e.g. after CSV import)
  useEffect(() => {
    setShifts(initialShifts)
  }, [initialShifts])

  function handleShiftSave(saved: ShiftWithSignups) {
    setShifts(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        // preserve existing signups on edit
        next[idx] = { ...saved, signups: prev[idx].signups }
        return next.sort((a, b) => a.date_time.localeCompare(b.date_time))
      }
      return [...prev, saved].sort((a, b) => a.date_time.localeCompare(b.date_time))
    })
    setAddingNew(false)
    setEditingId(null)
  }

  function handleDelete(shiftId: string) {
    setDeleteErrors(prev => ({ ...prev, [shiftId]: '' }))
    setConfirmingDeleteId(null)
    startDeleteTransition(async () => {
      const result = await deleteShift(shiftId, eventId)
      if ('error' in result) {
        setDeleteErrors(prev => ({ ...prev, [shiftId]: result.error }))
      } else {
        setShifts(prev => prev.filter(s => s.id !== shiftId))
      }
    })
  }

  function handleStatusChange(shiftId: string, signupId: string, status: 'confirmed' | 'no_show') {
    setSignupErrors(prev => ({ ...prev, [signupId]: '' }))
    startSignupTransition(async () => {
      const result = await updateSignupStatus(signupId, eventId, status)
      if ('error' in result) {
        setSignupErrors(prev => ({ ...prev, [signupId]: result.error }))
      } else {
        setShifts(prev => prev.map(s => s.id === shiftId
          ? { ...s, signups: s.signups.map(sg => sg.id === signupId ? { ...sg, status } : sg) }
          : s
        ))
      }
    })
  }

  function handleAreaLeadToggle(shiftId: string, signupId: string, isLead: boolean) {
    setSignupErrors(prev => ({ ...prev, [signupId]: '' }))
    startSignupTransition(async () => {
      const result = await toggleAreaLead(signupId, eventId, isLead)
      if ('error' in result) {
        setSignupErrors(prev => ({ ...prev, [signupId]: result.error }))
      } else {
        setShifts(prev => prev.map(s => s.id === shiftId
          ? { ...s, signups: s.signups.map(sg => sg.id === signupId ? { ...sg, area_lead_label: isLead } : sg) }
          : s
        ))
      }
    })
  }

  const confirmedCount = (shift: ShiftWithSignups) => shift.signups.filter(s => s.status === 'confirmed').length

  return (
    <div>
      {!addingNew && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <button
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            + Add Shift
          </button>
          <CSVImportPanel
            templatePath="/templates/volunteer-shifts-import-template.csv"
            templateLabel="Volunteer Shifts Template"
            onImport={csvText => importVolunteerCSV(eventId, csvText)}
            onSuccess={() => router.refresh()}
          />
        </div>
      )}

      {addingNew && (
        <div style={{ marginBottom: '16px' }}>
          <ShiftForm
            eventId={eventId}
            initial={EMPTY_SHIFT}
            onSave={handleShiftSave}
            onCancel={() => setAddingNew(false)}
          />
        </div>
      )}

      {shifts.length === 0 && !addingNew && (
        <p style={{ fontSize: '14px', color: 'var(--sd-muted)' }}>No shifts yet. Add the first one above.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {shifts.map(shift => (
          <div key={shift.id}>
            {editingId === shift.id ? (
              <ShiftForm
                eventId={eventId}
                initial={{
                  name: shift.name,
                  date_time: toDatetimeLocal(shift.date_time),
                  duration_minutes: String(shift.duration_minutes),
                  capacity: String(shift.capacity),
                  id: shift.id,
                }}
                onSave={handleShiftSave}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                {/* Shift header */}
                <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--sd-text)', marginBottom: '4px' }}>
                      {shift.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{formatShiftTime(shift.date_time)}</span>
                      <span>·</span>
                      <span>{formatDuration(shift.duration_minutes)}</span>
                      <span>·</span>
                      <span style={{ fontWeight: 600, color: confirmedCount(shift) >= shift.capacity ? '#dc2626' : 'var(--sd-text)' }}>
                        {confirmedCount(shift)}/{shift.capacity} filled
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    {shift.signups.length > 0 && (
                      <button
                        onClick={() => setExpandedId(expandedId === shift.id ? null : shift.id)}
                        style={{ fontSize: '12px', color: 'var(--sd-purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                      >
                        {expandedId === shift.id ? 'Hide' : `${shift.signups.length} signup${shift.signups.length !== 1 ? 's' : ''}`}
                      </button>
                    )}
                    {confirmingDeleteId === shift.id ? (
                      <>
                        <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Delete this shift?</span>
                        <button
                          onClick={() => handleDelete(shift.id)}
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
                          onClick={() => { setEditingId(shift.id); setAddingNew(false); setConfirmingDeleteId(null) }}
                          style={{ fontSize: '12px', color: 'var(--sd-purple)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(shift.id)}
                          disabled={isDeletePending || confirmedCount(shift) > 0}
                          title={confirmedCount(shift) > 0 ? 'Cannot delete a shift with confirmed signups' : undefined}
                          style={{ fontSize: '12px', color: confirmedCount(shift) > 0 ? 'var(--sd-muted)' : '#dc2626', background: 'none', border: 'none', cursor: confirmedCount(shift) > 0 || isDeletePending ? 'not-allowed' : 'pointer', textDecoration: confirmedCount(shift) > 0 ? 'none' : 'underline', padding: 0 }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {deleteErrors[shift.id] && (
                  <p style={{ fontSize: '12px', color: '#dc2626', margin: '0 16px 10px' }}>{deleteErrors[shift.id]}</p>
                )}

                {/* Signup table */}
                {expandedId === shift.id && shift.signups.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--sd-border)', padding: '12px 16px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: '8px', paddingRight: '16px' }}>Volunteer</th>
                          <th style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: '8px', paddingRight: '16px' }}>Status</th>
                          <th style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', paddingBottom: '8px' }}>Area Lead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shift.signups.map(signup => (
                          <tr key={signup.id} style={{ borderTop: '1px solid var(--sd-border-light)' }}>
                            <td style={{ padding: '8px 16px 8px 0', fontWeight: 500, color: 'var(--sd-text)' }}>
                              {signup.display_name}
                            </td>
                            <td style={{ padding: '8px 16px 8px 0' }}>
                              <select
                                value={signup.status}
                                disabled={isSignupPending}
                                onChange={e => handleStatusChange(shift.id, signup.id, e.target.value as 'confirmed' | 'no_show')}
                                style={{ fontSize: '12px', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--sd-border)', background: signup.status === 'no_show' ? '#FEF2F2' : 'var(--sd-card)', color: signup.status === 'no_show' ? '#dc2626' : 'var(--sd-text)', cursor: 'pointer' }}
                              >
                                <option value="confirmed">Confirmed</option>
                                <option value="no_show">No Show</option>
                              </select>
                            </td>
                            <td style={{ padding: '8px 0' }}>
                              <input
                                type="checkbox"
                                checked={signup.area_lead_label}
                                disabled={isSignupPending}
                                onChange={e => handleAreaLeadToggle(shift.id, signup.id, e.target.checked)}
                                style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {shift.signups.map(signup =>
                      signupErrors[signup.id] ? (
                        <p key={signup.id} style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', marginBottom: 0 }}>{signupErrors[signup.id]}</p>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
