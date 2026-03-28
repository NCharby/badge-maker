'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import CSVImportPanel from '@/components/ep/CSVImportPanel'
import {
  createRoom,
  updateRoom,
  deleteRoom,
  importRoomCSV,
  type RoomInput,
} from '@/app/(ep)/ep/venues/[venue-id]/actions'

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

interface Props {
  venueId: string
  initialRooms: Room[]
}

export default function VenueRoomsManageClient({ venueId, initialRooms }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [rooms, setRooms] = useState(initialRooms)
  const [addingRoom, setAddingRoom] = useState(false)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [confirmingDeleteRoomId, setConfirmingDeleteRoomId] = useState<string | null>(null)
  const [roomForm, setRoomForm] = useState<RoomFormState>(emptyRoomForm)
  const [roomError, setRoomError] = useState('')

  useEffect(() => { setRooms(initialRooms) }, [initialRooms])

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
          <input type="checkbox" id="venue_has_kitchen" checked={roomForm.has_kitchen} onChange={e => setRoomForm(p => ({ ...p, has_kitchen: e.target.checked }))} style={{ accentColor: 'var(--sd-purple)', cursor: 'pointer' }} />
          <label htmlFor="venue_has_kitchen" style={{ fontSize: '13px', color: 'var(--sd-text)', cursor: 'pointer' }}>Has kitchen</label>
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

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sd-text)', margin: 0 }}>
            Room Matrix
            <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sd-muted)', marginLeft: '8px' }}>
              {rooms.length} room{rooms.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <p style={{ fontSize: '11px', color: 'var(--sd-muted)', margin: '2px 0 0' }}>
            Rooms belong to this venue and are shared across all events that use it.
          </p>
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
  )
}
