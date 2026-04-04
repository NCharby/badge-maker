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
  TopOrgRow,
  TopEventRow,
  FunnelStep,
  OrgOperationalBreakdowns,
} from '@/lib/analytics/types'
import { computeTrend } from '@/lib/analytics/types'
import { formatCurrency, formatPercent } from '@/lib/analytics/format'
import { fetchAdminAnalyticsForPeriod } from './actions'

interface AdminAnalyticsClientProps {
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

const RANK_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#94A3B8',
  3: '#D97706',
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

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const PERIOD_OPTIONS: { label: string; days: number }[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'YTD', days: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) || 1 },
]

export default function AdminAnalyticsClient({
  financial: initialFinancial,
  priorFinancial: initialPriorFinancial,
  revenueTrend: initialRevenueTrend,
  topOrgs: initialTopOrgs,
  topEvents: initialTopEvents,
  funnel: initialFunnel,
  operational: initialOperational,
  activeEventCount: initialActiveEventCount,
  activeOrgCount: initialActiveOrgCount,
  totalAttendees: initialTotalAttendees,
}: AdminAnalyticsClientProps) {
  const [period, setPeriod] = useState<number>(30)
  const [isPending, startTransition] = useTransition()

  const [financial, setFinancial] = useState<FinancialSummary>(initialFinancial)
  const [priorFinancial, setPriorFinancial] = useState<FinancialSummary>(initialPriorFinancial)
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendPoint[]>(initialRevenueTrend)
  const [topOrgs, setTopOrgs] = useState<TopOrgRow[]>(initialTopOrgs)
  const [topEvents, setTopEvents] = useState<TopEventRow[]>(initialTopEvents)
  const [funnel, setFunnel] = useState<FunnelStep[]>(initialFunnel)
  const [operational, setOperational] = useState<OrgOperationalBreakdowns>(initialOperational)
  const [activeEventCount, setActiveEventCount] = useState<number>(initialActiveEventCount)
  const [activeOrgCount, setActiveOrgCount] = useState<number>(initialActiveOrgCount)
  const [totalAttendees, setTotalAttendees] = useState<number>(initialTotalAttendees)

  function handlePeriodChange(days: number) {
    if (days === period) return
    setPeriod(days)
    startTransition(async () => {
      const result = await fetchAdminAnalyticsForPeriod(days)
      if ('error' in result) return
      setFinancial(result.financial)
      setPriorFinancial(result.priorFinancial)
      setRevenueTrend(result.revenueTrend)
      setTopOrgs(result.topOrgs)
      setTopEvents(result.topEvents)
      setFunnel(result.funnel)
      setOperational(result.operational)
      setActiveEventCount(result.activeEventCount)
      setActiveOrgCount(result.activeOrgCount)
      setTotalAttendees(result.totalAttendees)
    })
  }

  const revenueTrend_ = computeTrend(financial.netRevenue, priorFinancial.netRevenue)
  const attendeesTrend_ = computeTrend(totalAttendees, 0) // no prior period attendee count available

  const periodLabel = PERIOD_OPTIONS.find(o => o.days === period)?.label ?? `${period}d`

  function TrendBadge({ trend, periodLbl }: { trend: ReturnType<typeof computeTrend>; periodLbl: string }) {
    if (trend.trend === 'flat' || trend.priorValue === 0) return null
    const isUp = trend.trend === 'up'
    const arrow = isUp ? '↑' : '↓'
    const color = isUp ? 'var(--sd-green)' : 'var(--sd-red)'
    return (
      <div style={{ fontSize: '11px', color, marginTop: '4px' }}>
        {arrow} {formatPercent(trend.trendPct)} vs prior {periodLbl}
      </div>
    )
  }

  const funnelMax = funnel[0]?.count || 1

  const applications = operational.applications
  const submittedCount =
    applications.approved +
    applications.declined +
    applications.needsReview +
    applications.completed +
    applications.closed
  const volunteers = operational.volunteers
  const refunds = operational.refunds

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Period Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {PERIOD_OPTIONS.map((opt) => {
          const isActive = period === opt.days
          return (
            <button
              key={opt.label}
              onClick={() => handlePeriodChange(opt.days)}
              disabled={isPending}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: isPending ? 'not-allowed' : 'pointer',
                border: isActive ? 'none' : '1px solid var(--sd-border)',
                background: isActive ? 'var(--sd-purple)' : 'var(--sd-card)',
                color: isActive ? '#fff' : 'var(--sd-muted)',
                opacity: isPending ? 0.6 : 1,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
        {isPending && (
          <span style={{ fontSize: '12px', color: 'var(--sd-muted)', marginLeft: '4px' }}>
            Loading&hellip;
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Platform Revenue */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--sd-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '8px',
            }}
          >
            Platform Revenue
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--sd-green)',
            }}
          >
            {formatCurrency(financial.netRevenue)}
          </div>
          <TrendBadge trend={revenueTrend_} periodLbl={periodLabel} />
        </div>

        {/* Active Events */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--sd-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '8px',
            }}
          >
            Active Events
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--sd-text)',
            }}
          >
            {activeEventCount.toString()}
          </div>
        </div>

        {/* Active Organizations */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--sd-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '8px',
            }}
          >
            Active Organizations
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--sd-text)',
            }}
          >
            {activeOrgCount.toString()}
          </div>
        </div>

        {/* Total Attendees */}
        <div style={cardStyle}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--sd-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '8px',
            }}
          >
            Total Attendees
          </div>
          <div
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: 'var(--sd-text)',
            }}
          >
            {totalAttendees.toString()}
          </div>
          <TrendBadge trend={attendeesTrend_} periodLbl={periodLabel} />
        </div>
      </div>

      {/* Revenue Trend */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>
          Revenue Trend — Last {periodLabel}
        </div>
        {revenueTrend.length === 0 ? (
          <div
            style={{
              height: '250px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--sd-muted)',
              fontSize: '13px',
            }}
          >
            No revenue data in this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={revenueTrend}
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(val: string) => {
                  const d = new Date(val + 'T00:00:00')
                  return d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(val: number) => `$${val.toFixed(0)}`}
                width={60}
              />
              <Tooltip
                formatter={(val) => [formatCurrency(Number(val ?? 0)), 'Revenue']}
                labelFormatter={(label) => {
                  const d = new Date(String(label) + 'T00:00:00')
                  return d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                }}
              />
              <Bar dataKey="revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Funnel + Top Orgs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Registration Funnel */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Registration Funnel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {funnel.map((step) => (
              <div key={step.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--sd-text)' }}>
                    {step.label}
                  </span>
                  <span style={{ color: 'var(--sd-muted)' }}>
                    {step.count.toLocaleString()} &nbsp;
                    <span style={{ color: 'var(--sd-xs)', fontSize: '12px' }}>
                      {formatPercent(step.pct)}
                    </span>
                  </span>
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
                      background: 'var(--sd-green)',
                      borderRadius: '4px',
                      height: '24px',
                      width: `${funnelMax > 0 ? (step.count / funnelMax) * 100 : 0}%`,
                      minWidth: step.count > 0 ? '4px' : '0',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Organizations by Revenue */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Top Organizations by Revenue</div>
          {topOrgs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--sd-muted)',
                fontSize: '13px',
                padding: '24px 0',
              }}
            >
              No data available.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topOrgs.map((org, idx) => {
                const rank = idx + 1
                const rankColor = RANK_COLORS[rank]
                return (
                  <div
                    key={org.orgId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: rankColor ?? 'var(--sd-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: rankColor ? '#fff' : 'var(--sd-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {rank}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '14px',
                          color: 'var(--sd-text)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {org.name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--sd-muted)',
                        }}
                      >
                        {org.eventCount} {org.eventCount === 1 ? 'event' : 'events'}
                      </div>
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--sd-green)',
                        flexShrink: 0,
                      }}
                    >
                      {formatCurrency(org.netRevenue)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Events by Revenue */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Top Events by Revenue</div>
        {topEvents.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: 'var(--sd-muted)',
              fontSize: '13px',
              padding: '24px 0',
            }}
          >
            No events to display.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--sd-border)',
                    background: 'var(--sd-card2)',
                  }}
                >
                  {['Rank', 'Event', 'Date', 'Attendees', 'Net Revenue'].map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topEvents.map((row, idx) => {
                  const rank = idx + 1
                  const rankColor = RANK_COLORS[rank]
                  const dateStr = new Date(
                    row.startDate + 'T00:00:00'
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  return (
                    <tr
                      key={row.eventId}
                      style={{
                        borderBottom:
                          idx < topEvents.length - 1
                            ? '1px solid var(--sd-border)'
                            : 'none',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: rankColor ?? 'var(--sd-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: rankColor ? '#fff' : 'var(--sd-muted)',
                          }}
                        >
                          {rank}
                        </div>
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 600,
                          color: 'var(--sd-text)',
                        }}
                      >
                        {row.title}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--sd-muted)',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dateStr}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          color: 'var(--sd-text)',
                          textAlign: 'right',
                        }}
                      >
                        {row.attendeeCount.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontWeight: 700,
                          color: 'var(--sd-green)',
                          textAlign: 'right',
                        }}
                      >
                        {formatCurrency(row.netRevenue)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Three-column: Application Stats, Volunteer Overview, Refund Breakdown */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
        }}
      >
        {/* Application Stats */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Application Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Submitted', value: submittedCount, color: 'var(--sd-text)' },
              { label: 'Approved', value: applications.approved, color: 'var(--sd-green)' },
              { label: 'Declined', value: applications.declined, color: 'var(--sd-red)' },
            ].map((row) => (
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
          <div style={cardHeaderStyle}>Volunteer Overview</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'Shifts Available', value: volunteers.totalShifts.toString(), color: 'var(--sd-text)' },
              { label: 'Shifts Filled', value: volunteers.confirmedSignups.toString(), color: 'var(--sd-text)' },
              { label: 'Fill Rate', value: formatPercent(volunteers.fillRate), color: 'var(--sd-green)' },
              { label: 'Hours Pledged', value: volunteers.totalHoursPledged.toString(), color: 'var(--sd-text)' },
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
          <div style={cardHeaderStyle}>Refund Breakdown</div>
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
