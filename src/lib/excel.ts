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

// ─── Event Accounting Workbook ─────────────────────────────────────────────

export interface AccountingExportData {
  eventTitle: string
  eventDates: string
  totalIncome: number
  totalRefunds: number
  totalCancellations: number
  netRevenue: number
  ticketRevenue: { name: string; issued: number; price: number; revenue: number }[]
  merchandiseRevenue: { name: string; qty: number; unitPrice: number; revenue: number; status: string }[]
}

const CURRENCY_FORMAT = '"$"#,##0.00'

export async function buildEventAccountingWorkbook(data: AccountingExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // ── Tab 1: Summary ──
  const summary = workbook.addWorksheet('Summary')
  setColumnWidths(summary, [28, 20])

  const titleRow = summary.addRow([data.eventTitle])
  titleRow.font = { bold: true, size: 14 }
  summary.addRow([data.eventDates])
  summary.addRow([])

  const kpis: [string, number][] = [
    ['Total Event Income', data.totalIncome],
    ['Total Refunds', data.totalRefunds],
    ['Total Cancellations', data.totalCancellations],
    ['Net Revenue', data.netRevenue],
  ]
  for (const [label, value] of kpis) {
    const row = summary.addRow([label, value])
    row.getCell(1).font = { bold: true }
    row.getCell(2).numFmt = CURRENCY_FORMAT
  }

  // ── Tab 2: Ticket Revenue ──
  const tickets = workbook.addWorksheet('Ticket Revenue')
  setColumnWidths(tickets, [30, 12, 14, 16])
  styleHeaderRow(tickets.addRow(['Ticket Type', 'Issued', 'Price', 'Revenue']))

  let ticketTotalIssued = 0
  let ticketTotalRevenue = 0
  for (const t of data.ticketRevenue) {
    const row = tickets.addRow([t.name, t.issued, t.price, t.revenue])
    row.getCell(3).numFmt = CURRENCY_FORMAT
    row.getCell(4).numFmt = CURRENCY_FORMAT
    ticketTotalIssued += t.issued
    ticketTotalRevenue += t.revenue
  }
  const ticketTotal = tickets.addRow(['Total', ticketTotalIssued, '', ticketTotalRevenue])
  ticketTotal.font = { bold: true }
  ticketTotal.getCell(4).numFmt = CURRENCY_FORMAT

  // ── Tab 3: Merchandise Revenue ──
  const merch = workbook.addWorksheet('Merchandise Revenue')
  setColumnWidths(merch, [30, 10, 14, 16, 12])
  styleHeaderRow(merch.addRow(['Product', 'Qty', 'Unit Price', 'Revenue', 'Status']))

  let merchTotalQty = 0
  let merchTotalRevenue = 0
  for (const m of data.merchandiseRevenue) {
    const row = merch.addRow([m.name, m.qty, m.unitPrice, m.revenue, m.status])
    row.getCell(3).numFmt = CURRENCY_FORMAT
    row.getCell(4).numFmt = CURRENCY_FORMAT
    merchTotalQty += m.qty
    merchTotalRevenue += m.revenue
  }
  const merchTotal = merch.addRow(['Total', merchTotalQty, '', merchTotalRevenue, ''])
  merchTotal.font = { bold: true }
  merchTotal.getCell(4).numFmt = CURRENCY_FORMAT

  const acctBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(acctBuffer)
}

// ─── Org Analytics Workbook ────────────────────────────────────────────────

export interface OrgAnalyticsExportData {
  orgName: string
  totalRevenue: number
  totalRefunds: number
  netRevenue: number
  activeEvents: number
  totalAttendees: number
  topEvents: { title: string; date: string; attendees: number; revenue: number }[]
  applicationStats: { submitted: number; approved: number; declined: number; approvalRate: number }
  volunteerStats: { shifts: number; filled: number; fillRate: number; hours: number }
  refundStats: { total: number; rate: number; byChannel: { channel: string; amount: number; count: number }[] }
}

export async function buildOrgAnalyticsWorkbook(data: OrgAnalyticsExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  // ── Tab 1: Summary ──
  const summary = workbook.addWorksheet('Summary')
  setColumnWidths(summary, [30, 22])

  const titleRow = summary.addRow([data.orgName])
  titleRow.font = { bold: true, size: 14 }
  summary.addRow(['Organization Analytics Export'])
  summary.addRow([])

  const kpis: [string, number][] = [
    ['Total Revenue', data.totalRevenue],
    ['Total Refunds', data.totalRefunds],
    ['Net Revenue', data.netRevenue],
    ['Active Events', data.activeEvents],
    ['Total Attendees', data.totalAttendees],
  ]
  for (const [label, value] of kpis) {
    const row = summary.addRow([label, value])
    row.getCell(1).font = { bold: true }
    const isMonetary = label.toLowerCase().includes('revenue') || label.toLowerCase().includes('refund')
    if (isMonetary) row.getCell(2).numFmt = CURRENCY_FORMAT
  }

  // ── Tab 2: Revenue by Event ──
  const events = workbook.addWorksheet('Revenue by Event')
  setColumnWidths(events, [36, 14, 14, 18])
  styleHeaderRow(events.addRow(['Event Title', 'Date', 'Attendees', 'Net Revenue']))

  let totalRevenue = 0
  let totalAttendees = 0
  for (const evt of data.topEvents) {
    const row = events.addRow([evt.title, evt.date, evt.attendees, evt.revenue])
    row.getCell(4).numFmt = CURRENCY_FORMAT
    totalRevenue += evt.revenue
    totalAttendees += evt.attendees
  }

  if (data.topEvents.length > 0) {
    const totalRow = events.addRow(['Total', '', totalAttendees, totalRevenue])
    totalRow.font = { bold: true }
    totalRow.getCell(4).numFmt = CURRENCY_FORMAT
  }

  // ── Tab 3: Operational Stats ──
  const ops = workbook.addWorksheet('Operational Stats')
  setColumnWidths(ops, [30, 20])

  // Section: Application Stats
  const appHeader = ops.addRow(['Application Stats'])
  appHeader.font = { bold: true, size: 12 }
  ops.addRow([])

  const appRows: [string, number | string][] = [
    ['Submitted', data.applicationStats.submitted],
    ['Approved', data.applicationStats.approved],
    ['Declined', data.applicationStats.declined],
    ['Approval Rate', `${(data.applicationStats.approvalRate * 100).toFixed(1)}%`],
  ]
  for (const [label, value] of appRows) {
    const row = ops.addRow([label, value])
    row.getCell(1).font = { bold: true }
  }

  ops.addRow([])
  ops.addRow([])

  // Section: Volunteer Overview
  const volHeader = ops.addRow(['Volunteer Overview'])
  volHeader.font = { bold: true, size: 12 }
  ops.addRow([])

  const volRows: [string, number | string][] = [
    ['Shifts Available', data.volunteerStats.shifts],
    ['Shifts Filled', data.volunteerStats.filled],
    ['Fill Rate', `${(data.volunteerStats.fillRate * 100).toFixed(1)}%`],
    ['Hours Pledged', data.volunteerStats.hours],
  ]
  for (const [label, value] of volRows) {
    const row = ops.addRow([label, value])
    row.getCell(1).font = { bold: true }
  }

  ops.addRow([])
  ops.addRow([])

  // Section: Refund Breakdown
  const refHeader = ops.addRow(['Refund Breakdown'])
  refHeader.font = { bold: true, size: 12 }
  ops.addRow([])

  const totalRefRow = ops.addRow(['Total Refunds', data.refundStats.total])
  totalRefRow.getCell(1).font = { bold: true }
  totalRefRow.getCell(2).numFmt = CURRENCY_FORMAT

  const refRateRow = ops.addRow(['Refund Rate', `${(data.refundStats.rate * 100).toFixed(1)}%`])
  refRateRow.getCell(1).font = { bold: true }

  if (data.refundStats.byChannel.length > 0) {
    ops.addRow([])
    styleHeaderRow(ops.addRow(['Channel', 'Amount', 'Count']))
    for (const ch of data.refundStats.byChannel) {
      const row = ops.addRow([
        ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1),
        ch.amount,
        ch.count,
      ])
      row.getCell(2).numFmt = CURRENCY_FORMAT
    }
  }

  const orgBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(orgBuffer)
}
