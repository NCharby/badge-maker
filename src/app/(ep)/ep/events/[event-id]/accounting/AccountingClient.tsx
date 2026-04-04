'use client'

import { useState, useTransition } from 'react'
import { exportEventAccountingExcel, exportEventAccountingPdf } from './actions'
import type {
  FinancialSummary,
  TicketRevenueRow,
  MerchandiseRevenueRow,
  AttendeeBreakdownRow,
  TicketCapacityRow,
} from '@/lib/analytics/types'
import { formatCurrency, formatPercent } from '@/lib/analytics/format'

interface AccountingClientProps {
  eventId: string
  eventTitle: string
  eventDates: string
  financial: FinancialSummary
  ticketRevenue: TicketRevenueRow[]
  merchandiseRevenue: MerchandiseRevenueRow[]
  attendeeBreakdown: AttendeeBreakdownRow[]
  ticketCapacity: TicketCapacityRow[]
}

type ActiveTab = 'accounting' | 'tickets'

// ── Shared card style ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--sd-card)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  padding: '1.25rem 1.5rem',
  marginBottom: '1.25rem',
}

const tableHeaderCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const tableBodyCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '14px',
  color: 'var(--sd-text)',
}

function badgeStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    background: bg,
    color,
  }
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 1)
  return (
    <div style={{ background: 'var(--sd-border)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
      <div style={{ background: 'var(--sd-green)', width: `${(clamped * 100).toFixed(1)}%`, height: '100%' }} />
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  valueColor,
}: {
  label: string
  value: string
  subtitle: string
  valueColor: string
}) {
  return (
    <div style={{ ...cardStyle, marginBottom: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: valueColor, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
        {subtitle}
      </div>
    </div>
  )
}

// ── Accounting tab ────────────────────────────────────────────────────────

function AccountingTab({
  financial,
  ticketRevenue,
  merchandiseRevenue,
  attendeeBreakdown,
}: {
  financial: FinancialSummary
  ticketRevenue: TicketRevenueRow[]
  merchandiseRevenue: MerchandiseRevenueRow[]
  attendeeBreakdown: AttendeeBreakdownRow[]
}) {
  const totalIssued = attendeeBreakdown.reduce((s, r) => s + r.count, 0)

  const ticketTotalIssued = ticketRevenue.reduce((s, r) => s + r.issuedCount, 0)
  const ticketTotalRevenue = ticketRevenue.reduce((s, r) => s + r.netRevenue, 0)

  const merchTotalQty = merchandiseRevenue.reduce((s, r) => s + r.qtySold, 0)
  const merchTotalRevenue = merchandiseRevenue.reduce((s, r) => s + r.netRevenue, 0)

  return (
    <>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <KpiCard
          label="Total Event Income"
          value={formatCurrency(financial.totalIncome)}
          subtitle="Since ticket sales opened"
          valueColor="var(--sd-text)"
        />
        <KpiCard
          label="Total Refunds"
          value={formatCurrency(financial.totalRefunds)}
          subtitle={`${financial.refundCount} refund transaction${financial.refundCount === 1 ? '' : 's'}`}
          valueColor="var(--sd-red)"
        />
        <KpiCard
          label="Total Cancellations"
          value={formatCurrency(financial.totalCancellations)}
          subtitle={`${financial.cancelledCount} cancelled order${financial.cancelledCount === 1 ? '' : 's'}`}
          valueColor="var(--sd-red)"
        />
        <KpiCard
          label="Net Revenue"
          value={formatCurrency(financial.netRevenue)}
          subtitle="After refunds & cancellations"
          valueColor="var(--sd-green)"
        />
      </div>

      {/* Total Attendees */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>Total Attendees</div>
          <div style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>{totalIssued} issued</div>
        </div>
        {attendeeBreakdown.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No attendees yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attendeeBreakdown.map(row => (
              <div key={row.ticketTypeName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', color: 'var(--sd-text)' }}>{row.ticketTypeName}</span>
                  {row.isRoomLead && (
                    <span style={badgeStyle('var(--sd-purple-light)', 'var(--sd-purple)')}>Room Lead</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>{formatPercent(row.pctOfTotal)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)', minWidth: '28px', textAlign: 'right' }}>{row.count}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Purchases table */}
      <div style={{ ...cardStyle, padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--sd-border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>Ticket Purchases</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
              {['Ticket Type', 'Issued', 'Pct', 'Price', 'Revenue'].map(h => (
                <th key={h} style={tableHeaderCellStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ticketRevenue.map((row, i) => (
              <tr key={row.ticketTypeId} style={{ borderBottom: i < ticketRevenue.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                <td style={tableBodyCellStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{row.name}</span>
                    {row.isSoldOut && (
                      <span style={badgeStyle('var(--sd-red-light)', 'var(--sd-red)')}>Sold Out</span>
                    )}
                    {!row.isSoldOut && row.availableCount !== null && row.availableCount - row.issuedCount <= 5 && row.availableCount - row.issuedCount > 0 && (
                      <span style={badgeStyle('var(--sd-amber-light)', 'var(--sd-amber)')}>
                        {row.availableCount - row.issuedCount} remaining
                      </span>
                    )}
                  </div>
                </td>
                <td style={tableBodyCellStyle}>{row.issuedCount}</td>
                <td style={{ ...tableBodyCellStyle, color: 'var(--sd-muted)' }}>{formatPercent(row.pctOfTotal)}</td>
                <td style={{ ...tableBodyCellStyle, color: 'var(--sd-muted)' }}>{formatCurrency(row.price)}</td>
                <td style={tableBodyCellStyle}>{formatCurrency(row.netRevenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
              <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>Total</td>
              <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>{ticketTotalIssued}</td>
              <td style={tableBodyCellStyle} />
              <td style={tableBodyCellStyle} />
              <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>{formatCurrency(ticketTotalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Product Purchases table */}
      {merchandiseRevenue.length > 0 && (
        <div style={{ ...cardStyle, padding: 0 }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--sd-border)' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>Product Purchases</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                {['Product', 'Qty', 'Unit Price', 'Revenue', 'Status'].map(h => (
                  <th key={h} style={tableHeaderCellStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merchandiseRevenue.map((row, i) => {
                let statusBg = 'var(--sd-green-light)'
                let statusColor = 'var(--sd-green-dark)'
                if (row.status === 'Sold Out') { statusBg = 'var(--sd-red-light)'; statusColor = 'var(--sd-red)' }
                if (row.status === 'Ended') { statusBg = 'var(--sd-card2)'; statusColor = 'var(--sd-muted)' }

                return (
                  <tr key={row.merchandiseId} style={{ borderBottom: i < merchandiseRevenue.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                    <td style={tableBodyCellStyle}>{row.name}</td>
                    <td style={tableBodyCellStyle}>{row.qtySold}</td>
                    <td style={{ ...tableBodyCellStyle, color: 'var(--sd-muted)' }}>{formatCurrency(row.unitPrice)}</td>
                    <td style={tableBodyCellStyle}>{formatCurrency(row.netRevenue)}</td>
                    <td style={tableBodyCellStyle}>
                      <span style={badgeStyle(statusBg, statusColor)}>{row.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
                <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>Total</td>
                <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>{merchTotalQty}</td>
                <td style={tableBodyCellStyle} />
                <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>{formatCurrency(merchTotalRevenue)}</td>
                <td style={tableBodyCellStyle} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}

// ── Ticket Sales tab ──────────────────────────────────────────────────────

function TicketSalesTab({ ticketCapacity, ticketRevenue }: { ticketCapacity: TicketCapacityRow[]; ticketRevenue: TicketRevenueRow[] }) {
  const totalIssued = ticketCapacity.reduce((s, r) => s + r.issuedCount, 0)
  const totalCapacity = ticketCapacity.reduce((s, r) => s + (r.availableCount ?? 0), 0)
  const hasUnlimited = ticketCapacity.some(r => r.availableCount === null)
  const overallFillPct = !hasUnlimited && totalCapacity > 0 ? totalIssued / totalCapacity : null
  const totalRemaining = hasUnlimited ? null : totalCapacity - totalIssued

  return (
    <>
      {/* Ticket Types card */}
      <div style={cardStyle}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1rem' }}>Ticket Types</div>
        {ticketCapacity.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--sd-muted)' }}>No ticket types configured.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {ticketCapacity.map(row => (
              <div key={row.ticketTypeId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--sd-text)' }}>{row.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
                      {row.availableCount !== null ? `x${row.availableCount}` : 'Unlimited'}
                    </span>
                    {row.isSoldOut && (
                      <span style={badgeStyle('var(--sd-red-light)', 'var(--sd-red)')}>Sold Out</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--sd-text)' }}>{row.issuedCount} issued</span>
                    <span style={{ color: 'var(--sd-muted)' }}>
                      {row.remainingCount !== null ? `${row.remainingCount} remaining` : '\u221e remaining'}
                    </span>
                  </div>
                </div>
                {row.fillPct !== null && (
                  <ProgressBar pct={row.fillPct} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Capacity Summary card */}
      <div style={cardStyle}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '1rem' }}>Event Capacity Summary</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Issued</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sd-text)' }}>{totalIssued}</div>
          </div>
          <div style={{ flex: 1 }}>
            {overallFillPct !== null ? (
              <>
                <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--sd-muted)', marginBottom: '6px' }}>
                  {formatPercent(overallFillPct)} issued
                </div>
                <ProgressBar pct={overallFillPct} />
              </>
            ) : (
              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--sd-muted)' }}>Unlimited capacity</div>
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sd-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>Remaining</div>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--sd-text)' }}>
              {totalRemaining !== null ? totalRemaining : '\u221e'}
            </div>
          </div>
        </div>
        {!hasUnlimited && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--sd-muted)', borderTop: '1px solid var(--sd-border)', paddingTop: '12px' }}>
            Total quantity {totalCapacity}
          </div>
        )}
      </div>

      {/* Issued Tickets by Type table */}
      <div style={{ ...cardStyle, padding: 0 }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--sd-border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--sd-text)' }}>Issued Tickets by Type</div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
              {['Ticket Type', 'Issued', 'Percentage', 'List Price'].map(h => (
                <th key={h} style={tableHeaderCellStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ticketRevenue.map((row, i) => (
              <tr key={row.ticketTypeId} style={{ borderBottom: i < ticketRevenue.length - 1 ? '1px solid var(--sd-border)' : 'none' }}>
                <td style={tableBodyCellStyle}>{row.name}</td>
                <td style={tableBodyCellStyle}>{row.issuedCount}</td>
                <td style={{ ...tableBodyCellStyle, color: 'var(--sd-muted)' }}>{formatPercent(row.pctOfTotal)}</td>
                <td style={{ ...tableBodyCellStyle, color: 'var(--sd-muted)' }}>{formatCurrency(row.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--sd-border)', background: 'var(--sd-card2)' }}>
              <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>Total</td>
              <td style={{ ...tableBodyCellStyle, fontWeight: 700 }}>{ticketRevenue.reduce((s, r) => s + r.issuedCount, 0)}</td>
              <td style={tableBodyCellStyle} />
              <td style={tableBodyCellStyle} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

// ── Main client component ─────────────────────────────────────────────────

export function AccountingClient({
  eventId,
  eventTitle,
  eventDates,
  financial,
  ticketRevenue,
  merchandiseRevenue,
  attendeeBreakdown,
  ticketCapacity,
}: AccountingClientProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('accounting')
  const [isExportingExcel, startExportExcel] = useTransition()
  const [isExportingPdf, startExportPdf] = useTransition()
  const [exportError, setExportError] = useState('')

  function handleExportExcel() {
    setExportError('')
    startExportExcel(async () => {
      const result = await exportEventAccountingExcel(eventId)
      if ('error' in result) {
        setExportError(result.error)
      } else {
        window.open(result.url, '_blank')
      }
    })
  }

  function handleExportPdf() {
    setExportError('')
    startExportPdf(async () => {
      const result = await exportEventAccountingPdf(eventId)
      if ('error' in result) {
        setExportError(result.error)
      } else {
        window.open(result.url, '_blank')
      }
    })
  }

  const isExporting = isExportingExcel || isExportingPdf

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'accounting', label: 'Accounting' },
    { id: 'tickets', label: 'Ticket Sales' },
  ]

  return (
    <>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sd-text)', marginBottom: '4px' }}>
        Accounting
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '20px' }}>
        {eventTitle} &middot; {eventDates}
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--sd-border)', marginBottom: '1.5rem', gap: '4px' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--sd-text)' : 'var(--sd-muted)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--sd-purple)' : '2px solid transparent',
                cursor: 'pointer',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Export bar */}
      {activeTab === 'accounting' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
          {exportError && (
            <span style={{ fontSize: '12px', color: 'var(--sd-red)', alignSelf: 'center', marginRight: 'auto' }}>
              {exportError}
            </span>
          )}
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--sd-border)',
              background: 'var(--sd-card)',
              color: 'var(--sd-text)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExportingExcel ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid var(--sd-border)',
              background: 'var(--sd-card)',
              color: 'var(--sd-text)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.6 : 1,
            }}
          >
            {isExportingPdf ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'accounting' ? (
        <AccountingTab
          financial={financial}
          ticketRevenue={ticketRevenue}
          merchandiseRevenue={merchandiseRevenue}
          attendeeBreakdown={attendeeBreakdown}
        />
      ) : (
        <TicketSalesTab
          ticketCapacity={ticketCapacity}
          ticketRevenue={ticketRevenue}
        />
      )}
    </>
  )
}
