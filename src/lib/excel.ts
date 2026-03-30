import ExcelJS from 'exceljs'

// ─── Shared helpers ────────────────────────────────────────────────────────

const YELLOW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9D9D9' },
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.fill = HEADER_FILL
  row.alignment = { vertical: 'middle', wrapText: true }
}

function setColumnWidths(sheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })
}

// ─── Hotel Weekly Workbook ──────────────────────────────────────────────────

export interface HotelWeeklyRow {
  roomNumber: string
  roomName: string
  roomType: string | null
  roomCode: string | null
  guestSceneName: string
  checkIn: string | null
  checkOut: string | null
  lockStatus: string
  roomId: string // used internally for diff; not included in sheet
}

/**
 * Build the single-sheet hotel weekly Excel workbook.
 * Rows whose `roomId` is in `changedRoomIds` are highlighted yellow.
 */
export async function buildHotelWeeklyWorkbook(
  rows: HotelWeeklyRow[],
  changedRoomIds: Set<string>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Room List')

  setColumnWidths(sheet, [14, 22, 16, 14, 24, 14, 14, 14])

  const header = sheet.addRow([
    'Room Number',
    'Room Name',
    'Room Type',
    'Room Code',
    'Guest Scene Name',
    'Check-in',
    'Check-out',
    'Lock Status',
  ])
  styleHeaderRow(header)

  for (const r of rows) {
    const dataRow = sheet.addRow([
      r.roomNumber,
      r.roomName,
      r.roomType ?? '',
      r.roomCode ?? '',
      r.guestSceneName,
      r.checkIn ?? '',
      r.checkOut ?? '',
      r.lockStatus,
    ])
    if (changedRoomIds.has(r.roomId)) {
      dataRow.eachCell((cell) => {
        cell.fill = YELLOW_FILL
      })
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ─── Offline Packet Workbook ────────────────────────────────────────────────

export interface OfflinePacketData {
  attendeeRoomList: AttendeeRoomRow[]
  roomLockIssues: RoomLockIssueRow[]
  roomLockChanges: RoomLockChangeRow[]
  volunteerSchedule: VolunteerScheduleRow[]
  eventSchedule: EventScheduleRow[]
}

export interface AttendeeRoomRow {
  sceneName: string
  roomNumber: string
  roomType: string | null
  roomCode: string | null
  checkIn: string | null
  checkOut: string | null
}

export interface RoomLockIssueRow {
  sceneName: string
  email: string
  ticketType: string | null
  lockStatus: string
}

export interface RoomLockChangeRow {
  sceneName: string
  previousRoom: string
  currentRoom: string
  changedAt: string | null
}

export interface VolunteerScheduleRow {
  shiftName: string
  dateTime: string
  durationMinutes: number
  capacity: number
  volunteers: string // comma-separated scene names
}

export interface EventScheduleRow {
  activityName: string
  dateTime: string
  durationMinutes: number
  description: string
  volunteersRequested: number | null
}

/**
 * Build the four-tab offline packet Excel workbook.
 */
export async function buildOfflinePacketWorkbook(data: OfflinePacketData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // ── Tab 1: Attendee Room List ──
  const tab1 = workbook.addWorksheet('Attendee Room List')
  setColumnWidths(tab1, [24, 14, 16, 14, 14, 14])
  styleHeaderRow(
    tab1.addRow(['Scene Name', 'Room Number', 'Room Type', 'Room Code', 'Check-in', 'Check-out'])
  )
  // Sorted by room number (caller should pre-sort, but defensive sort here)
  const sortedAttendees = [...data.attendeeRoomList].sort((a, b) =>
    a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
  )
  for (const r of sortedAttendees) {
    tab1.addRow([r.sceneName, r.roomNumber, r.roomType ?? '', r.roomCode ?? '', r.checkIn ?? '', r.checkOut ?? ''])
  }

  // ── Tab 2: Room Lock Status ──
  const tab2 = workbook.addWorksheet('Room Lock Status')

  // Section A: Room Lock Issue Report
  const issueHeader = tab2.addRow(['Room Lock Issue Report'])
  issueHeader.font = { bold: true, size: 12 }
  tab2.addRow([]) // spacer
  styleHeaderRow(tab2.addRow(['Scene Name', 'Email', 'Ticket Type', 'Lock Status']))
  for (const r of data.roomLockIssues) {
    tab2.addRow([r.sceneName, r.email, r.ticketType ?? '', r.lockStatus])
  }
  if (data.roomLockIssues.length === 0) {
    tab2.addRow(['No issues found.'])
  }

  tab2.addRow([]) // spacer
  tab2.addRow([]) // spacer

  // Section B: Room Lock Change Report
  const changeHeader = tab2.addRow(['Room Lock Change Report'])
  changeHeader.font = { bold: true, size: 12 }
  tab2.addRow([]) // spacer
  styleHeaderRow(tab2.addRow(['Scene Name', 'Previous Room', 'Current Room', 'Changed At']))
  for (const r of data.roomLockChanges) {
    tab2.addRow([r.sceneName, r.previousRoom, r.currentRoom, r.changedAt ?? ''])
  }
  if (data.roomLockChanges.length === 0) {
    tab2.addRow(['No changes found.'])
  }

  setColumnWidths(tab2, [24, 28, 16, 18, 22])

  // ── Tab 3: Volunteer Schedule ──
  const tab3 = workbook.addWorksheet('Volunteer Schedule')
  setColumnWidths(tab3, [28, 20, 16, 12, 40])
  styleHeaderRow(
    tab3.addRow(['Shift Name', 'Date & Time', 'Duration (min)', 'Capacity', 'Confirmed Volunteers'])
  )
  const sortedShifts = [...data.volunteerSchedule].sort((a, b) =>
    a.dateTime.localeCompare(b.dateTime)
  )
  for (const r of sortedShifts) {
    tab3.addRow([r.shiftName, r.dateTime, r.durationMinutes, r.capacity, r.volunteers])
  }

  // ── Tab 4: Event Schedule ──
  const tab4 = workbook.addWorksheet('Event Schedule')
  setColumnWidths(tab4, [28, 20, 16, 40, 18])
  styleHeaderRow(
    tab4.addRow(['Activity Name', 'Date & Time', 'Duration (min)', 'Description', 'Volunteers Requested'])
  )
  const sortedActivities = [...data.eventSchedule].sort((a, b) =>
    a.dateTime.localeCompare(b.dateTime)
  )
  for (const r of sortedActivities) {
    tab4.addRow([
      r.activityName,
      r.dateTime,
      r.durationMinutes,
      r.description,
      r.volunteersRequested !== null ? r.volunteersRequested : '',
    ])
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
