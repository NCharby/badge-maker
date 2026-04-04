'use server'

import { epEventGuard } from '@/lib/auth/ep-guard'
import { getEventFinancialSummary, getEventTicketRevenue, getEventMerchandiseRevenue } from '@/lib/analytics/queries'
import { buildEventAccountingWorkbook } from '@/lib/excel'
import { generatePDFFromHTML } from '@/lib/pdf'
import { buildAccountingPdfHtml } from '@/lib/analytics/pdf-templates'
import { createAdminClient } from '@/lib/supabase/server'

export async function exportEventAccountingExcel(
  eventId: string,
): Promise<{ url: string } | { error: string }> {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Unauthorized' }

  try {
    const adminClient = createAdminClient()

    const { data: event } = await adminClient
      .from('platform_events')
      .select('title, start_date, end_date')
      .eq('id', eventId)
      .single()
    if (!event) return { error: 'Event not found' }

    const startDate = new Date(event.start_date + 'T00:00:00')
    const endDate = new Date(event.end_date + 'T00:00:00')
    const eventDates = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const [financial, ticketRev, merchRev] = await Promise.all([
      getEventFinancialSummary(adminClient, eventId),
      getEventTicketRevenue(adminClient, eventId),
      getEventMerchandiseRevenue(adminClient, eventId),
    ])

    const buffer = await buildEventAccountingWorkbook({
      eventTitle: event.title,
      eventDates,
      totalIncome: financial.totalIncome,
      totalRefunds: financial.totalRefunds,
      totalCancellations: financial.totalCancellations,
      netRevenue: financial.netRevenue,
      ticketRevenue: ticketRev.map(t => ({
        name: t.name,
        issued: t.issuedCount,
        price: t.price,
        revenue: t.netRevenue,
      })),
      merchandiseRevenue: merchRev.map(m => ({
        name: m.name,
        qty: m.qtySold,
        unitPrice: m.unitPrice,
        revenue: m.netRevenue,
        status: m.status,
      })),
    })

    const path = `analytics/event-${eventId}/accounting-${Date.now()}.xlsx`
    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      })
    if (uploadError) return { error: uploadError.message }

    const { data: signed } = await adminClient.storage
      .from('reports')
      .createSignedUrl(path, 300)
    if (!signed?.signedUrl) return { error: 'Failed to create download URL' }

    return { url: signed.signedUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Export failed' }
  }
}

export async function exportEventAccountingPdf(
  eventId: string,
): Promise<{ url: string } | { error: string }> {
  const { authorized, admin } = await epEventGuard(eventId)
  if (!authorized || !admin) return { error: 'Unauthorized' }

  try {
    const adminClient = createAdminClient()

    const { data: event } = await adminClient
      .from('platform_events')
      .select('title, start_date, end_date')
      .eq('id', eventId)
      .single()
    if (!event) return { error: 'Event not found' }

    const startDate = new Date(event.start_date + 'T00:00:00')
    const endDate = new Date(event.end_date + 'T00:00:00')
    const eventDates = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const [financial, ticketRev, merchRev] = await Promise.all([
      getEventFinancialSummary(adminClient, eventId),
      getEventTicketRevenue(adminClient, eventId),
      getEventMerchandiseRevenue(adminClient, eventId),
    ])

    const html = buildAccountingPdfHtml({
      eventTitle: event.title,
      eventDates,
      totalIncome: financial.totalIncome,
      totalRefunds: financial.totalRefunds,
      totalCancellations: financial.totalCancellations,
      netRevenue: financial.netRevenue,
      ticketRevenue: ticketRev.map(t => ({
        name: t.name,
        issued: t.issuedCount,
        price: t.price,
        revenue: t.netRevenue,
      })),
      merchandiseRevenue: merchRev.map(m => ({
        name: m.name,
        qty: m.qtySold,
        unitPrice: m.unitPrice,
        revenue: m.netRevenue,
        status: m.status,
      })),
    })

    const buffer = await generatePDFFromHTML(html)

    const path = `analytics/event-${eventId}/accounting-${Date.now()}.pdf`
    const { error: uploadError } = await adminClient.storage
      .from('reports')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })
    if (uploadError) return { error: uploadError.message }

    const { data: signed } = await adminClient.storage
      .from('reports')
      .createSignedUrl(path, 300)
    if (!signed?.signedUrl) return { error: 'Failed to create download URL' }

    return { url: signed.signedUrl }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Export failed' }
  }
}
