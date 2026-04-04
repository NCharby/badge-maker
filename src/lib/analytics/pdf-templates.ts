import type { AccountingExportData } from '@/lib/excel'

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text).replace(/[&<>"']/g, (c) => map[c])
}

function fmt(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function buildAccountingPdfHtml(data: AccountingExportData): string {
  const ticketTotalIssued = data.ticketRevenue.reduce((s, r) => s + r.issued, 0)
  const ticketTotalRevenue = data.ticketRevenue.reduce((s, r) => s + r.revenue, 0)

  const merchTotalQty = data.merchandiseRevenue.reduce((s, r) => s + r.qty, 0)
  const merchTotalRevenue = data.merchandiseRevenue.reduce((s, r) => s + r.revenue, 0)

  const ticketRows = data.ticketRevenue
    .map(
      (t) => `
      <tr>
        <td>${escapeHtml(t.name)}</td>
        <td class="num">${t.issued}</td>
        <td class="num">${fmt(t.price)}</td>
        <td class="num">${fmt(t.revenue)}</td>
      </tr>`,
    )
    .join('')

  const merchRows = data.merchandiseRevenue
    .map(
      (m) => `
      <tr>
        <td>${escapeHtml(m.name)}</td>
        <td class="num">${m.qty}</td>
        <td class="num">${fmt(m.unitPrice)}</td>
        <td class="num">${fmt(m.revenue)}</td>
        <td>${escapeHtml(m.status)}</td>
      </tr>`,
    )
    .join('')

  const merchSection =
    data.merchandiseRevenue.length > 0
      ? `
      <h2>Merchandise Revenue</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">Revenue</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${merchRows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>Total</strong></td>
            <td class="num"><strong>${merchTotalQty}</strong></td>
            <td></td>
            <td class="num"><strong>${fmt(merchTotalRevenue)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.eventTitle)} — Accounting Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #1a1a18;
      background: #fff;
      padding: 40px 48px;
    }

    /* ── Header ── */
    .report-header {
      margin-bottom: 28px;
      padding-bottom: 16px;
      border-bottom: 2px solid #1a1a18;
    }
    .report-header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a18;
      margin-bottom: 4px;
    }
    .report-header .dates {
      font-size: 12px;
      color: #6b6a66;
    }
    .report-header .label {
      font-size: 11px;
      font-weight: 600;
      color: #6b6a66;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-top: 12px;
    }

    /* ── KPI grid ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      border: 1px solid #d4d2cc;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .kpi-card .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b6a66;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
    }
    .kpi-card .kpi-value {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a18;
    }
    .kpi-card .kpi-value.net-revenue {
      color: #22c55e;
    }
    .kpi-card .kpi-value.negative {
      color: #dc2626;
    }

    /* ── Section headings ── */
    h2 {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a18;
      margin-bottom: 10px;
      margin-top: 28px;
    }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 8px;
    }
    thead tr {
      background: #f0efec;
    }
    th {
      padding: 8px 12px;
      text-align: left;
      font-size: 10px;
      font-weight: 600;
      color: #6b6a66;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 1px solid #d4d2cc;
    }
    td {
      padding: 9px 12px;
      border: 1px solid #d4d2cc;
      color: #1a1a18;
    }
    tbody tr:nth-child(even) {
      background: #f6f5f2;
    }
    .num {
      text-align: right;
    }
    tfoot tr.total-row td {
      background: #f0efec;
      border-top: 2px solid #d4d2cc;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #d4d2cc;
      font-size: 10px;
      color: #a8a7a2;
    }
  </style>
</head>
<body>
  <div class="report-header">
    <p class="label">Accounting Report</p>
    <h1>${escapeHtml(data.eventTitle)}</h1>
    <p class="dates">${escapeHtml(data.eventDates)}</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Income</div>
      <div class="kpi-value">${fmt(data.totalIncome)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Refunds</div>
      <div class="kpi-value negative">${fmt(data.totalRefunds)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Cancellations</div>
      <div class="kpi-value negative">${fmt(data.totalCancellations)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Net Revenue</div>
      <div class="kpi-value net-revenue">${fmt(data.netRevenue)}</div>
    </div>
  </div>

  <h2>Ticket Revenue</h2>
  <table>
    <thead>
      <tr>
        <th>Ticket Type</th>
        <th class="num">Issued</th>
        <th class="num">Price</th>
        <th class="num">Revenue</th>
      </tr>
    </thead>
    <tbody>
      ${ticketRows}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="num"><strong>${ticketTotalIssued}</strong></td>
        <td></td>
        <td class="num"><strong>${fmt(ticketTotalRevenue)}</strong></td>
      </tr>
    </tfoot>
  </table>

  ${merchSection}

  <div class="report-footer">
    Generated ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
  </div>
</body>
</html>`
}
