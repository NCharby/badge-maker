'use client'

import { useState, useTransition } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type {
  FinancialSummary,
  RevenueTrendPoint,
  TopEventRow,
  FunnelStep,
  RetentionRow,
  OrgOperationalBreakdowns,
} from '@/lib/analytics/types'
import { computeTrend } from '@/lib/analytics/types'
import { formatCurrency, formatPercent } from '@/lib/analytics/format'
import { fetchOrgAnalyticsForPeriod, exportOrgAnalyticsExcel } from './actions'

interface OrgAnalyticsClientProps {
  orgSlug: string
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

// Recharts cannot read CSS custom properties — use matching hex values
const CHART_GREEN = '#22c55e'
const CHART_MUTED = '#6b7280'

type PeriodDays = 7 | 30 | 90 | number

function getPeriodLabel(days: number): string {
  if (days === 7) return '7d'
  if (days === 30) return '30d'
  if (days === 90) return '90d'
  return 'YTD'
}

function getYtdDays(): number {
  return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)
}

function formatTrendDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rankBadgeStyle(rank: number): React.CSSProperties {
  const base: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }
  if (rank === 1) return { ...base, background: '#FEF3C7', color: '#F59E0B' }
  if (rank === 2) return { ...base, background: '#F1F5F9', color: '#94A3B8' }
  if (rank === 3) return { ...base, background: '#FEF3C7', color: '#D97706' }
  return { ...base, background: 'var(--sd-card2)', color: 'var(--sd-muted)' }
}

const cardStyle: React.CSSProperties = {
  background: 'var(--sd-card)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  padding: '20px',
}

const cardHeaderStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 700,
  color: 'var(--sd-text)',
  marginBottom: '16px',
}

const tableHeaderStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

interface TrendBadgeProps {
  current: number
  prior: number
  /** When true, going up is bad (e.g. refund rate) */
  invertColor?: boolean
  periodLabel: string
}

function TrendBadge({ current, prior, invertColor, periodLabel }: TrendBadgeProps) {
  const kpi = computeTrend(current, prior)
  if (kpi.trend === 'flat' || kpi.priorValue === 0) return null

  const isPositive = kpi.trend === 'up'
  const isGood = invertColor ? !isPositive : isPositive
  const color = isGood ? 'var(--sd-green)' : 'var(--sd-red)'
  const arrow = kpi.trend === 'up' ? '↑' : '↓'
  const pct = (kpi.trendPct * 100).toFixed(1)

  return (
    <div
      style={{
        fontSize: '11px',
        fontWeight: 600,
        color,
        marginTop: '4px',
      }}
    >
      {arrow} {pct}% vs prior {periodLabel}
    </div>
  )
}

export default function OrgAnalyticsClient({
  orgSlug,
  financial: initialFinancial,
  priorFinancial: initialPriorFinancial,
  revenueTrend: initialRevenueTrend,
  topEvents: initialTopEvents,
  funnel: initialFunnel,
  retention: initialRetention,
  operational: initialOperational,
  activeEventCount: initialActiveEventCount,
  totalAttendees: initialTotalAttendees,
  avgTicketPrice: initialAvgTicketPrice,
}: OrgAnalyticsClientProps) {
  const ytdDays = getYtdDays()

  const [selectedPeriod, setSelectedPeriod] = useState<number>(30)
  const [financial, setFinancial] = useState(initialFinancial)
  const [priorFinancial, setPriorFinancial] = useState(initialPriorFinancial)
  const [revenueTrend, setRevenueTrend] = useState(initialRevenueTrend)
  const [topEvents, setTopEvents] = useState(initialTopEvents)
  const [funnel, setFunnel] = useState(initialFunnel)
  const [retention, setRetention] = useState(initialRetention)
  const [operational, setOperational] = useState(initialOperational)
  const [activeEventCount, setActiveEventCount] = useState(initialActiveEventCount)
  const [totalAttendees, setTotalAttendees] = useState(initialTotalAttendees)
  const [avgTicketPrice, setAvgTicketPrice] = useState(initialAvgTicketPrice)

  const [isPeriodPending, startPeriodTransition] = useTransition()
  const [isExportPending, startExportTransition] = useTransition()
  const [exportError, setExportError] = useState<string | null>(null)

  function handlePeriodChange(days: number) {
    setSelectedPeriod(days)
    startPeriodTransition(async () => {
      const result = await fetchOrgAnalyticsForPeriod(orgSlug, days)
      if ('error' in result) return
      setFinancial(result.financial)
      setPriorFinancial(result.priorFinancial)
      setRevenueTrend(result.revenueTrend)
      setTopEvents(result.topEvents)
      setFunnel(result.funnel)
      setRetention(result.retention)
      setOperational(result.operational)
      setActiveEventCount(result.activeEventCount)
      setTotalAttendees(result.totalAttendees)
      setAvgTicketPrice(result.avgTicketPrice)
    })
  }

  function handleExport() {
    setExportError(null)
    startExportTransition(async () => {
      const result = await exportOrgAnalyticsExcel(orgSlug)
      if ('error' in result) {
        setExportError(result.error)
        return
      }
      const link = document.createElement('a')
      link.href = result.url
      link.download = `org-analytics.xlsx`
      link.click()
    })
  }

  const periodLabel = getPeriodLabel(selectedPeriod)

  const periodOptions: { label: string; days: number }[] = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: 'YTD', days: ytdDays },
  ]

  const kpiCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(financial.netRevenue),
      valueColor: 'var(--sd-green)',
      trend: { current: financial.netRevenue, prior: priorFinancial.netRevenue },
    },
    {
      label: 'Active Events',
      value: activeEventCount.toString(),
      valueColor: 'var(--sd-text)',
      trend: null,
    },
    {
      label: 'Total Attendees',
      value: totalAttendees.toString(),
      valueColor: 'var(--sd-text)',
      trend: { current: totalAttendees, prior: 0 },
    },
    {
      label: 'Refund Rate',
      value: formatPercent(operational.refunds.refundRate),
      valueColor: 'var(--sd-red)',
      trend: null,
    },
    {
      label: 'Avg Ticket Price',
      value: formatCurrency(avgTicketPrice),
      valueColor: 'var(--sd-text)',
      trend: { current: avgTicketPrice, prior: priorFinancial.orderCount > 0 ? priorFinancial.totalIncome / priorFinancial.orderCount : 0 },
    },
  ]

  const applications = operational.applications
  const submittedCount =
    applications.approved +
    applications.declined +
    applications.needsReview +
    applications.completed +
    applications.closed

  const volunteers = operational.volunteers
  const refunds = operational.refunds

  // Retention average row
  const calculableRows = retention.filter(r => r.retentionPct !== null)
  const retentionTotalAttendees = calculableRows.reduce((s, r) => s + r.attendeeCount, 0)
  const retentionTotalReturned = calculableRows.reduce((s, r) => s + (r.returnedCount ?? 0), 0)
  const avgRetention = retentionTotalAttendees > 0 ? retentionTotalReturned / retentionTotalAttendees : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Page header row: period selector + export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Period selector */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {periodOptions.map(opt => {
            const isActive = selectedPeriod === opt.days
            return (
              <button
                key={opt.label}
                onClick={() => handlePeriodChange(opt.days)}
                disabled={isPeriodPending}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? 'none' : '1px solid var(--sd-border)',
                  background: isActive ? 'var(--sd-purple)' : 'var(--sd-card)',
                  color: isActive ? '#fff' : 'var(--sd-muted)',
                  opacity: isPeriodPending ? 0.6 : 1,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Export button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {exportError && (
            <span style={{ fontSize: '12px', color: 'var(--sd-red)' }}>{exportError}</span>
          )}
          <button
            onClick={handleExport}
            disabled={isExportPending}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isExportPending ? 'not-allowed' : 'pointer',
              border: '1px solid var(--sd-border)',
              background: 'var(--sd-card)',
              color: 'var(--sd-text)',
              opacity: isExportPending ? 0.6 : 1,
            }}
          >
            {isExportPending ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '12px',
          opacity: isPeriodPending ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {kpiCards.map(card => (
          <div key={card.label} style={cardStyle}>
            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 700,
                color: card.valueColor,
                lineHeight: 1.1,
                marginBottom: '4px',
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--sd-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {card.label}
            </div>
            {card.trend && (
              <TrendBadge
                current={card.trend.current}
                prior={card.trend.prior}
                periodLabel={periodLabel}
              />
            )}
          </div>
        ))}
      </div>

      {/* Revenue Trend */}
      <div style={{ ...cardStyle, opacity: isPeriodPending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <h2 style={cardHeaderStyle}>Revenue Trend — Last {periodLabel}</h2>
        {revenueTrend.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>
            No revenue data in this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={revenueTrend}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tickFormatter={formatTrendDate}
                tick={{ fontSize: 11, fill: CHART_MUTED }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: CHART_MUTED }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `$${v}`}
                width={56}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                labelFormatter={(label) => formatTrendDate(String(label))}
                contentStyle={{
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="revenue" fill={CHART_GREEN} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column: Funnel + Top Events */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          opacity: isPeriodPending ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {/* Registration Funnel */}
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Registration Funnel</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funnel.map((step, idx) => {
              const barOpacity = 1 - idx * 0.15
              return (
                <div key={step.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'var(--sd-text)', fontWeight: 500 }}>
                      {step.label}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--sd-muted)',
                          minWidth: '32px',
                          textAlign: 'right',
                        }}
                      >
                        {step.count}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--sd-xs)', minWidth: '40px', textAlign: 'right' }}>
                        {formatPercent(step.pct)}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--sd-border-light)',
                      borderRadius: '4px',
                      height: '24px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        background: `rgba(29, 158, 117, ${barOpacity})`,
                        borderRadius: '4px',
                        height: '24px',
                        width: `${Math.max(step.pct * 100, step.count > 0 ? 2 : 0)}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top Events by Revenue */}
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Top Events by Revenue</h2>
          {topEvents.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No events yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {topEvents.map((evt, idx) => {
                const rank = idx + 1
                const startDate = new Date(evt.startDate + 'T00:00:00')
                const dateLabel = startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })
                return (
                  <div
                    key={evt.eventId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      paddingBottom: '10px',
                      borderBottom: idx < topEvents.length - 1 ? '1px solid var(--sd-border-light)' : 'none',
                    }}
                  >
                    <div style={rankBadgeStyle(rank)}>{rank}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--sd-text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {evt.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--sd-muted)' }}>
                        {dateLabel} &middot; {evt.attendeeCount} attendees
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--sd-green)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCurrency(evt.netRevenue)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Attendee Retention Table */}
      <div style={{ ...cardStyle, opacity: isPeriodPending ? 0.6 : 1, transition: 'opacity 0.15s' }}>
        <h2 style={cardHeaderStyle}>Attendee Retention by Event</h2>
        {retention.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No event data yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Event', 'Attendees', 'Returned', 'Retention'].map(col => (
                    <th
                      key={col}
                      style={{
                        ...tableHeaderStyle,
                        textAlign: col === 'Event' ? 'left' : 'right',
                        paddingBottom: '8px',
                        borderBottom: '1px solid var(--sd-border)',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retention.map((row, idx) => {
                  const startDate = new Date(row.startDate + 'T00:00:00')
                  const dateLabel = startDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  const isUpcoming = row.retentionPct === null && row.returnedCount === null

                  return (
                    <tr
                      key={row.eventId}
                      style={{
                        borderBottom: '1px solid var(--sd-border-light)',
                      }}
                    >
                      <td style={{ padding: '10px 0', color: 'var(--sd-text)', fontWeight: 500 }}>
                        <div>{row.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--sd-muted)', fontWeight: 400 }}>
                          {dateLabel}
                        </div>
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--sd-text)' }}>
                        {row.attendeeCount}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: 'var(--sd-muted)' }}>
                        {row.returnedCount ?? '—'}
                      </td>
                      <td style={{ padding: '10px 0', textAlign: 'right' }}>
                        {isUpcoming ? (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '99px',
                              fontSize: '10px',
                              fontWeight: 600,
                              background: 'var(--sd-blue-light)',
                              color: 'var(--sd-blue)',
                            }}
                          >
                            Upcoming
                          </span>
                        ) : row.retentionPct !== null ? (
                          <span style={{ fontWeight: 600, color: 'var(--sd-green)' }}>
                            {formatPercent(row.retentionPct)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* Weighted average row */}
                {calculableRows.length > 0 && (
                  <tr style={{ background: 'var(--sd-card2)' }}>
                    <td
                      style={{
                        padding: '10px 0',
                        color: 'var(--sd-text)',
                        fontWeight: 700,
                      }}
                    >
                      Organization Average
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        color: 'var(--sd-text)',
                        fontWeight: 700,
                      }}
                    >
                      {retentionTotalAttendees}
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        color: 'var(--sd-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {retentionTotalReturned}
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--sd-green)',
                      }}
                    >
                      {avgRetention !== null ? formatPercent(avgRetention) : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Three-column: Applications, Volunteers, Refunds */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          opacity: isPeriodPending ? 0.6 : 1,
          transition: 'opacity 0.15s',
        }}
      >
        {/* Application Stats */}
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Application Stats</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Submitted', value: submittedCount, color: 'var(--sd-text)' },
              { label: 'Approved', value: applications.approved, color: 'var(--sd-green)' },
              { label: 'Declined', value: applications.declined, color: 'var(--sd-red)' },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--sd-border-light)',
                }}
              >
                <span style={{ color: 'var(--sd-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              }}
            >
              <span style={{ color: 'var(--sd-muted)' }}>Approval Rate</span>
              <span style={{ fontWeight: 700, color: 'var(--sd-green)' }}>
                {formatPercent(applications.approvalRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Volunteer Overview */}
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Volunteer Overview</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Shifts Available', value: volunteers.totalShifts.toString(), color: 'var(--sd-text)' },
              { label: 'Shifts Filled', value: volunteers.confirmedSignups.toString(), color: 'var(--sd-text)' },
              {
                label: 'Fill Rate',
                value: formatPercent(volunteers.fillRate),
                color: 'var(--sd-green)',
              },
              {
                label: 'Hours Pledged',
                value: volunteers.totalHoursPledged.toString(),
                color: 'var(--sd-text)',
              },
            ].map((row, idx, arr) => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  paddingBottom: idx < arr.length - 1 ? '8px' : '0',
                  borderBottom: idx < arr.length - 1 ? '1px solid var(--sd-border-light)' : 'none',
                }}
              >
                <span style={{ color: 'var(--sd-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Refund Breakdown */}
        <div style={cardStyle}>
          <h2 style={cardHeaderStyle}>Refund Breakdown</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--sd-border-light)',
              }}
            >
              <span style={{ color: 'var(--sd-muted)' }}>Total Refunds</span>
              <span style={{ fontWeight: 600, color: 'var(--sd-red)' }}>
                {formatCurrency(refunds.totalAmount)}
              </span>
            </div>
            {refunds.byChannel.length > 0 ? (
              refunds.byChannel.map((ch, idx) => (
                <div
                  key={ch.channel}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '12px',
                    paddingBottom: idx < refunds.byChannel.length - 1 ? '8px' : '0',
                    borderBottom:
                      idx < refunds.byChannel.length - 1
                        ? '1px solid var(--sd-border-light)'
                        : 'none',
                  }}
                >
                  <span style={{ color: 'var(--sd-muted)', textTransform: 'capitalize' }}>
                    {ch.channel} ({ch.count})
                  </span>
                  <span style={{ fontWeight: 500, color: 'var(--sd-red)' }}>
                    {formatCurrency(ch.amount)}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--sd-xs)' }}>No refunds recorded.</div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                paddingTop: '4px',
                borderTop:
                  refunds.byChannel.length > 0 ? '1px solid var(--sd-border-light)' : 'none',
              }}
            >
              <span style={{ color: 'var(--sd-muted)' }}>Refund Rate</span>
              <span style={{ fontWeight: 700, color: 'var(--sd-red)' }}>
                {formatPercent(refunds.refundRate)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
