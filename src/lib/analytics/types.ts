// ── Event-Level Types ──────────────────────────────────────────────────────

export interface FinancialSummary {
  totalIncome: number
  totalRefunds: number
  totalCancellations: number
  netRevenue: number
  orderCount: number
  refundCount: number
  cancelledCount: number
}

export interface TicketRevenueRow {
  ticketTypeId: string
  name: string
  price: number
  issuedCount: number
  pctOfTotal: number
  grossRevenue: number
  refundedAmount: number
  netRevenue: number
  availableCount: number | null // null = unlimited
  isSoldOut: boolean
}

export interface MerchandiseRevenueRow {
  merchandiseId: string
  name: string
  unitPrice: number
  qtySold: number
  grossRevenue: number
  refundedAmount: number
  netRevenue: number
  availableCount: number | null
  enabled: boolean
  status: 'Active' | 'Sold Out' | 'Ended'
}

export interface AttendeeBreakdownRow {
  ticketTypeName: string
  count: number
  pctOfTotal: number
  isRoomLead: boolean
}

export interface TicketCapacityRow {
  ticketTypeId: string
  name: string
  price: number
  availableCount: number | null
  issuedCount: number
  remainingCount: number | null // null = unlimited
  fillPct: number | null
  isSoldOut: boolean
}

export interface VolunteerStats {
  totalShifts: number
  totalCapacity: number
  confirmedSignups: number
  fillRate: number
  noShowCount: number
  totalHoursPledged: number
}

export interface ApplicationStats {
  incomplete: number
  inProgress: number
  needsReview: number
  completed: number
  approved: number
  declined: number
  closed: number
  approvalRate: number
}

export interface RefundByChannel {
  channel: string // 'standard' | 'hardship' | 'chargeback'
  amount: number
  count: number
}

// ── Trend / Period Types ──────────────────────────────────────────────────

export type TrendDirection = 'up' | 'down' | 'flat'

export interface KpiWithTrend {
  value: number
  priorValue: number
  trend: TrendDirection
  trendPct: number // absolute percentage change
}

export function computeTrend(current: number, prior: number): KpiWithTrend {
  const diff = current - prior
  const trend: TrendDirection = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const trendPct = prior !== 0 ? Math.abs(diff / prior) : current > 0 ? 1 : 0
  return { value: current, priorValue: prior, trend, trendPct }
}

/** Full data payload returned by period-switching server actions */
export interface AnalyticsPeriodData {
  financial: FinancialSummary
  priorFinancial: FinancialSummary
  revenueTrend: RevenueTrendPoint[]
  topEvents: TopEventRow[]
  funnel: FunnelStep[]
  retention: RetentionRow[]
  operational: OrgOperationalBreakdowns
  activeEventCount: number
  totalAttendees: number
  avgTicketPrice: number
}

/** Admin variant includes top orgs */
export interface AdminAnalyticsPeriodData {
  financial: FinancialSummary
  priorFinancial: FinancialSummary
  revenueTrend: RevenueTrendPoint[]
  topOrgs: TopOrgRow[]
  topEvents: TopEventRow[]
  funnel: FunnelStep[]
  operational: OrgOperationalBreakdowns
  activeEventCount: number
  activeOrgCount: number
  totalAttendees: number
}

// ── Org / Platform Level Types ────────────────────────────────────────────

export interface RevenueTrendPoint {
  date: string // ISO date string (day)
  revenue: number
}

export interface TopEventRow {
  eventId: string
  title: string
  startDate: string
  attendeeCount: number
  netRevenue: number
}

export interface TopOrgRow {
  orgId: string
  name: string
  eventCount: number
  netRevenue: number
}

export interface FunnelStep {
  label: string
  count: number
  pct: number
}

export interface RetentionRow {
  eventId: string
  title: string
  startDate: string
  attendeeCount: number
  returnedCount: number | null // null = upcoming, can't calculate yet
  retentionPct: number | null
}

export interface OrgOperationalBreakdowns {
  applications: ApplicationStats
  volunteers: VolunteerStats
  refunds: {
    totalAmount: number
    totalCount: number
    refundRate: number
    byChannel: RefundByChannel[]
  }
}
