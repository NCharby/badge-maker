'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CSVImportPanel from '@/components/ep/CSVImportPanel'
import {
  updateVenue,
  archiveVenue,
  unarchiveVenue,
  deleteVenue,
  createRoom,
  updateRoom,
  deleteRoom,
  importRoomCSV,
  type VenueInput,
  type RoomInput,
} from './actions'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: '7px',
  border: '1px solid var(--sd-border)',
  fontSize: '13px',
  color: 'var(--sd-text)',
  background: '#fff',
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

type Venue = {
  id: string
  name: string
  physical_address: string
  website: string | null
  email: string | null
  phone: string | null
  poc_name: string | null
  poc_phone: string | null
  poc_email: string | null
  status: string
  notification_config: {
    weekly_hotel_report?: boolean
    room_lock_report?: boolean
  }
}

type Room = {
  id: string
  number: string | null
  name: string
  description: string | null
  bed_spot_count: number
  min_occupancy: number
  room_code: string | null
  lodging_type: string | null
  bed_type: string | null
  has_kitchen: boolean
  location_zone: string | null
  room_group: string | null
}

type RoomFormState = {
  number: string
  name: string
  description: string
  bed_spot_count: string
  min_occupancy: string
  room_code: string
  lodging_type: string
  bed_type: string
  has_kitchen: boolean
  location_zone: string
  room_group: string
}

const emptyRoomForm: RoomFormState = {
  number: '',
  name: '',
  description: '',
  bed_spot_count: '',
  min_occupancy: '',
  room_code: '',
  lodging_type: '',
  bed_type: '',
  has_kitchen: false,
  location_zone: '',
  room_group: '',
}

function roomToForm(room: Room): RoomFormState {
  return {
    number: room.number ?? '',
    name: room.name,
    description: room.description ?? '',
    bed_spot_count: String(room.bed_spot_count),
    min_occupancy: String(room.min_occupancy),
    room_code: room.room_code ?? '',
    lodging_type: room.lodging_type ?? '',
    bed_type: room.bed_type ?? '',
    has_kitchen: room.has_kitchen,
    location_zone: room.location_zone ?? '',
    room_group: room.room_group ?? '',
  }
}

function venueToForm(v: Venue): VenueInput {
  return {
    name: v.name,
    physical_address: v.physical_address,
    website: v.website ?? '',
    email: v.email ?? '',
    phone: v.phone ?? '',
    poc_name: v.poc_name ?? '',
    poc_phone: v.poc_phone ?? '',
    poc_email: v.poc_email ?? '',
    notification_config: {
      weekly_hotel_report: v.notification_config?.weekly_hotel_report ?? false,
      room_lock_report: v.notification_config?.room_lock_report ?? false,
    },
  }
}

interface Props {
  venueId: string
  initialVenue: Venue
  initialRooms: Room[]
}

export default function VenueDetailClient({ venueId, initialVenue, initialRooms }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Venue state
  const [venue, setVenue] = useState(initialVenue)
  const [editingVenue, setEditingVenue] = useState(false)
  const [venueForm, setVenueForm] = useState<VenueInput>(venueToForm(initialVenue))
  const [venueError, setVenueError] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [lifecycleError, setLifecycleError] = useState('')

  // Room state
  const [rooms, setRooms] = useState(initialRooms)
  const [addingRoom, setAddingRoom] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [confirmingDeleteRoomId, setConfirmingDeleteRoomId] = useState<string | null>(null)
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm)
  const [roomError, setRoomError] = useState('')

  // Sync state when server re-renders after router.refresh()
  useEffect(() => { setVenue(initialVenue) }, [initialVenue])
  useEffect(() => { setRooms(initialRooms) }, [initialRooms])

  // Venue handlers
  function startEditVenue() {
    setVenueForm(venueToForm(venue))
    setVenueError('')
    setEditingVenue(true)
    setConfirmingArchive(false)
    setConfirmingDelete(false)
    setLifecycleError('')
  }

  function handleSaveVenue() {
    setVenueError('')
    if (!venueForm.name.trim()) { setVenueError('Venue name is required.'); return }
    if (!venueForm.physical_address.trim()) { setVenueError('Physical address is required.'); return }
    startTransition(async () => {
      const result = await updateVenue(venueId, venueForm)
      if ('error' in result) {
        setVenueError(result.error)
      } else {
        setVenue(prev => ({
          ...prev,
          name: venueForm.name.trim(),
          physical_address: venueForm.physical_address.trim(),
          website: venueForm.website.trim() || null,
          email: venueForm.email.trim() || null,
          phone: venueForm.phone.trim() || null,
          poc_name: venueForm.poc_name.trim() || null,
          poc_phone: venueForm.poc_phone.trim() || null,
          poc_email: venueForm.poc_email.trim() || null,
          notification_config: venueForm.notification_config,
        }))
        setEditingVenue(false)
      }
    })
  }

  function handleArchive() {
    setLifecycleError('')
    startTransition(async () => {
      const result = await archiveVenue(venueId)
      if ('error' in result) {
        setLifecycleError(result.error)
      } else {
        setConfirmingArchive(false)
        router.push('/ep/venues')
      }
    })
  }

  function handleUnarchive() {
    setLifecycleError('')
    startTransition(async () => {
      const result = await unarchiveVenue(venueId)
      if ('error' in result) {
        setLifecycleError(result.error)
      } else {
        setVenue(prev => ({ ...prev, status: 'active' }))
      }
    })
  }

  function handleDelete() {
    setLifecycleError('')
    startTransition(async () => {
      const result = await deleteVenue(venueId)
      if ('error' in result) {
        setLifecycleError(result.error)
        setConfirmingDelete(false)
      } else {
        router.push('/ep/venues')
      }
    })
  }

  // Room handlers
  function startAddRoom() {
    setRoomForm(emptyRoomForm)
    setRoomError('')
    setEditingRoomId(null)
    setAddingRoom(true)
  }

  function startEditRoom(room: Room) {
    setRoomForm(roomToForm(room))
    setRoomError('')
    setAddingRoom(false)
    setEditingRoomId(room.id)
    setConfirmingDeleteRoomId(null)
  }

  function cancelRoomForm() {
    setAddingRoom(false)
    setEditingRoomId(null)
    setRoomError('')
  }

  function handleSaveRoom() {
    setRoomError('')
    startTransition(async () => {
      const data: RoomInput = roomForm
      let result: { success: true } | { error: string }
      if (editingRoomId) {
        result = await updateRoom(editingRoomId, venueId, data)
      } else {
        result = await createRoom(venueId, data)
      }
      if ('error' in result) {
        setRoomError(result.error)
      } else {
        setAddingRoom(false)
        setEditingRoomId(null)
        router.refresh()
      }
    })
  }

  function handleDeleteRoom(roomId: string) {
    setRoomError('')
    startTransition(async () => {
      const result = await deleteRoom(roomId, venueId)
      if ('error' in result) {
        setRoomError(result.error)
      } else {
        setConfirmingDeleteRoomId(null)
        router.refresh()
      }
    })
  }

  function renderRoomForm(label: string) {
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
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--sd-text)' }}>{label}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Room Number</label>
            <input style={inputStyle} value={roomForm.number} onChange={e => setRoomForm(p => ({ ...p, number: e.target.value }))} placeholder="e.g. 101 (auto if blank)" />
          </div>
          <div>
            <label style={labelStyle}>Room Name *</label>
            <input style={inputStyle} value={roomForm.name} onChange={e => setRoomForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. King Studio" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Max Occupancy *</label>
            <input type="number" min="1" style={inputStyle} value={roomForm.bed_spot_count} onChange={e => setRoomForm(p => ({ ...p, bed_spot_count: e.target.value }))} placeholder="e.g. 4" />
          </div>
          <div>
            <label style={labelStyle}>Min Occupancy *</label>
            <input type="number" min="1" style={inputStyle} value={roomForm.min_occupancy} onChange={e => setRoomForm(p => ({ ...p, min_occupancy: e.target.value }))} placeholder="e.g. 2" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Lodging Type</label>
            <input style={inputStyle} value={roomForm.lodging_type} onChange={e => setRoomForm(p => ({ ...p, lodging_type: e.target.value }))} placeholder="e.g. Studio, Suite" />
          </div>
          <div>
            <label style={labelStyle}>Bed Type</label>
            <input style={inputStyle} value={roomForm.bed_type} onChange={e => setRoomForm(p => ({ ...p, bed_type: e.target.value }))} placeholder="e.g. King, Queen, Bunk" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          <div>
            <label style={labelStyle}>Location Zone</label>
            <input style={inputStyle} value={roomForm.location_zone} onChange={e => setRoomForm(p => ({ ...p, location_zone: e.target.value }))} placeholder="e.g. Hill, Garden" />
          </div>
          <div>
            <label style={labelStyle}>Room Group</label>
            <input style={inputStyle} value={roomForm.room_group} onChange={e => setRoomForm(p => ({ ...p, room_group: e.target.value }))} placeholder="e.g. VIP, Standard" />
          </div>
          <div>
            <label style={labelStyle}>Room Code</label>
            <input style={inputStyle} value={roomForm.room_code} onChange={e => setRoomForm(p => ({ ...p, room_code: e.target.value }))} placeholder="Hotel check-in code" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} value={roomForm.description} onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes about this room" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="has_kitchen" checked={roomForm.has_kitchen} onChange={e => setRoomForm(p => ({ ...p, has_kitchen: e.target.checked }))} style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }} />
          <label htmlFor="has_kitchen" style={{ fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer' }}>Has kitchen</label>
        </div>

        {roomError && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{roomError}</p>}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={cancelRoomForm}
            style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '13px', color: 'var(--sd-muted)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveRoom}
            disabled={isPending}
            style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
          >
            {isPending ? 'Saving…' : 'Save Room'}
          </button>
        </div>
      </div>
    )
  }

  const pillStyle: React.CSSProperties = {
    fontSize: '11px',
    padding: '2px 7px',
    borderRadius: '999px',
    background: 'var(--sd-purple-light)',
    color: 'var(--sd-purple)',
    fontWeight: 500,
  }

  const isArchived = venue.status === 'archived'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Archived banner */}
      {isArchived && (
        <div style={{
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: 'var(--sd-radius)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <span style={{ fontSize: '13px', color: '#92400E', fontWeight: 500 }}>
            This venue is archived and will not appear in event settings.
          </span>
          <button
            onClick={handleUnarchive}
            disabled={isPending}
            style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #FED7AA', background: '#FFF7ED', fontSize: '12px', fontWeight: 600, color: '#92400E', cursor: isPending ? 'not-allowed' : 'pointer', flexShrink: 0 }}
          >
            Restore
          </button>
        </div>
      )}

      {/* Venue Info */}
      <div style={{ background: 'var(--sd-card)', border: '1px solid var(--sd-border)', borderRadius: 'var(--sd-radius)', padding: '24px' }}>
        {!editingVenue ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>{venue.name}</h1>
              <button
                onClick={startEditVenue}
                style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
              >
                Edit
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)', margin: '0 0 8px' }}>{venue.physical_address}</p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {venue.website && <a href={venue.website} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--sd-purple)', textDecoration: 'none' }}>{venue.website}</a>}
              {venue.email && <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{venue.email}</span>}
              {venue.phone && <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{venue.phone}</span>}
            </div>

            {(venue.poc_name || venue.poc_email || venue.poc_phone) && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--sd-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sd-muted)', marginBottom: '6px' }}>
                  Event Point of Contact
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px' }}>
                  {venue.poc_name && <span style={{ fontWeight: 500, color: 'var(--sd-text)' }}>{venue.poc_name}</span>}
                  {venue.poc_phone && <span style={{ color: 'var(--sd-muted)' }}>{venue.poc_phone}</span>}
                  {venue.poc_email && <span style={{ color: 'var(--sd-muted)' }}>{venue.poc_email}</span>}
                </div>
              </div>
            )}

            {(venue.notification_config?.weekly_hotel_report || venue.notification_config?.room_lock_report) && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--sd-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sd-muted)', marginBottom: '6px' }}>
                  Notifications Enabled
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {venue.notification_config?.weekly_hotel_report && (
                    <span style={{ fontSize: '12px', background: '#EFF6FF', color: '#3B82F6', borderRadius: '99px', padding: '2px 8px', fontWeight: 500 }}>
                      Weekly Hotel Report
                    </span>
                  )}
                  {venue.notification_config?.room_lock_report && (
                    <span style={{ fontSize: '12px', background: '#EFF6FF', color: '#3B82F6', borderRadius: '99px', padding: '2px 8px', fontWeight: 500 }}>
                      Room Lock Report
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--sd-text)' }}>Edit Venue</div>

            <div>
              <label style={labelStyle}>Venue Name *</label>
              <input style={inputStyle} value={venueForm.name} onChange={e => setVenueForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Physical Address *</label>
              <input style={inputStyle} value={venueForm.physical_address} onChange={e => setVenueForm(p => ({ ...p, physical_address: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={venueForm.website} onChange={e => setVenueForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" style={inputStyle} value={venueForm.email} onChange={e => setVenueForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input style={inputStyle} value={venueForm.phone} onChange={e => setVenueForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
            </div>

            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--sd-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
                Event Point of Contact
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>POC Name</label>
                  <input style={inputStyle} value={venueForm.poc_name} onChange={e => setVenueForm(p => ({ ...p, poc_name: e.target.value }))} placeholder="e.g. Jane Smith" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>POC Email</label>
                    <input type="email" style={inputStyle} value={venueForm.poc_email} onChange={e => setVenueForm(p => ({ ...p, poc_email: e.target.value }))} placeholder="poc@venue.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>POC Phone</label>
                    <input style={inputStyle} value={venueForm.poc_phone} onChange={e => setVenueForm(p => ({ ...p, poc_phone: e.target.value }))} placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '10px', borderTop: '1px solid var(--sd-border)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Notifications to POC
              </div>
              <div style={{ fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '10px' }}>
                Reports are sent to the POC email above, or the venue email if no POC email is set.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={venueForm.notification_config.weekly_hotel_report}
                    onChange={e => setVenueForm(p => ({ ...p, notification_config: { ...p.notification_config, weekly_hotel_report: e.target.checked } }))}
                    style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--sd-text)', fontWeight: 500 }}>Weekly Hotel Report</div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Send weekly room booking summary to POC.</div>
                  </div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={venueForm.notification_config.room_lock_report}
                    onChange={e => setVenueForm(p => ({ ...p, notification_config: { ...p.notification_config, room_lock_report: e.target.checked } }))}
                    style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--sd-text)', fontWeight: 500 }}>Room Lock Report</div>
                    <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Send room lock list to POC when rooms are locked.</div>
                  </div>
                </label>
              </div>
            </div>

            {venueError && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: 0 }}>{venueError}</p>}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingVenue(false)} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '13px', color: 'var(--sd-muted)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveVenue} disabled={isPending} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Room Matrix */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>
              Room Matrix
              <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sd-muted)', marginLeft: '8px' }}>
                {rooms.length} room{rooms.length !== 1 ? 's' : ''}
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <CSVImportPanel
              templatePath="/templates/room-matrix-template.csv"
              templateLabel="Room Matrix Template"
              onImport={csvText => importRoomCSV(venueId, csvText)}
              onSuccess={() => router.refresh()}
            />
            {!addingRoom && !editingRoomId && (
              <button
                onClick={startAddRoom}
                style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', background: 'var(--sd-purple)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                + Add Room
              </button>
            )}
          </div>
        </div>

        {addingRoom && renderRoomForm('Add Room')}

        {rooms.length === 0 && !addingRoom ? (
          <div style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '32px',
            textAlign: 'center',
          }}>
            <p style={{ color: 'var(--sd-muted)', fontSize: '13px', marginBottom: '10px' }}>No rooms yet.</p>
            <p style={{ color: 'var(--sd-muted)', fontSize: '12px', margin: 0 }}>
              Add rooms manually or upload a CSV using the Room Matrix Template.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rooms.map(room => (
              <div key={room.id}>
                {editingRoomId === room.id ? (
                  renderRoomForm('Edit Room')
                ) : (
                  <div style={{
                    background: 'var(--sd-card)',
                    border: '1px solid var(--sd-border)',
                    borderRadius: 'var(--sd-radius)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        {room.number && (
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', background: '#F3F4F6', borderRadius: '4px', padding: '1px 6px' }}>
                            #{room.number}
                          </span>
                        )}
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{room.name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                          {room.min_occupancy}–{room.bed_spot_count} guests
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {room.lodging_type && <span style={pillStyle}>{room.lodging_type}</span>}
                        {room.bed_type && <span style={pillStyle}>{room.bed_type}</span>}
                        {room.has_kitchen && <span style={pillStyle}>Kitchen</span>}
                        {room.location_zone && <span style={{ ...pillStyle, background: '#EFF6FF', color: '#3B82F6' }}>{room.location_zone}</span>}
                        {room.room_group && <span style={{ ...pillStyle, background: '#F0FDF4', color: '#16A34A' }}>{room.room_group}</span>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {confirmingDeleteRoomId === room.id ? (
                        <>
                          <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Delete this room?</span>
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            disabled={isPending}
                            style={{ padding: '4px 10px', borderRadius: '5px', border: 'none', background: 'var(--sd-red)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.7 : 1 }}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmingDeleteRoomId(null)}
                            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditRoom(room)}
                            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => { setConfirmingDeleteRoomId(room.id); setRoomError('') }}
                            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {roomError && !editingRoomId && !addingRoom && (
          <p style={{ fontSize: '12px', color: 'var(--sd-red)', marginTop: '8px' }}>{roomError}</p>
        )}
      </div>

      {/* Danger Zone */}
      <div style={{
        background: 'var(--sd-card)',
        border: '1px solid var(--sd-border)',
        borderRadius: 'var(--sd-radius)',
        padding: '20px 24px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '12px' }}>Danger Zone</div>

        {lifecycleError && <p style={{ fontSize: '12px', color: 'var(--sd-red)', margin: '0 0 12px' }}>{lifecycleError}</p>}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {!isArchived ? (
            <>
              {!confirmingArchive ? (
                <button
                  onClick={() => { setConfirmingArchive(true); setConfirmingDelete(false); setLifecycleError('') }}
                  style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #FED7AA', background: '#FFF7ED', fontSize: '13px', color: '#92400E', cursor: 'pointer' }}
                >
                  Archive Venue
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Archive this venue?</span>
                  <button
                    onClick={handleArchive}
                    disabled={isPending}
                    style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: '#92400E', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
                  >
                    Yes, Archive
                  </button>
                  <button
                    onClick={() => setConfirmingArchive(false)}
                    style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : null}

          {!confirmingDelete ? (
            <button
              onClick={() => { setConfirmingDelete(true); setConfirmingArchive(false); setLifecycleError('') }}
              style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #FECACA', background: '#FEF2F2', fontSize: '13px', color: 'var(--sd-red)', cursor: 'pointer' }}
            >
              Delete Venue
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>Permanently delete this venue and all its rooms?</span>
              <button
                onClick={handleDelete}
                disabled={isPending}
                style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--sd-red)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: isPending ? 'not-allowed' : 'pointer' }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--sd-border)', background: 'none', fontSize: '12px', color: 'var(--sd-muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
