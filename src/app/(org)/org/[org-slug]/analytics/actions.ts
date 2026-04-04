'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { checkOrgAccess } from '@/lib/auth/event-access'
import {
  getOrgFinancialSummary,
  getOrgRevenueTrend,
  getOrgTopEventsByRevenue,
  getOrgRegistrationFunnel,
  getOrgAttendeeRetention,
  getOrgOperationalBreakdowns,
} from '@/lib/analytics/queries'
import type { AnalyticsPeriodData, FinancialSummary } from '@/lib/analytics/types'
import { buildOrgAnalyticsWorkbook } from '@/lib/excel'

async function requireOrgAnalyticsAccess(
  orgSlug: string,
): Promise<{ orgId: string; orgName: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()
  const { data: org } = await admin
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single()
  if (!org) return { error: 'Organization not found.' }

  const access = await checkOrgAccess(user.id, org.id)
  if (!access.authorized) return { error: 'Access denied.' }

  return { orgId: org.id, orgName: org.name }
}

function subtractFinancial(combined: FinancialSummary, current: FinancialSummary): FinancialSummary {
  const totalIncome = combined.totalIncome - current.totalIncome
  const totalRefunds = combined.totalRefunds - current.totalRefunds
  const totalCancellations = combined.totalCancellations - current.totalCancellations
  return {
    totalIncome,
    totalRefunds,
    totalCancellations,
    netRevenue: totalIncome - totalRefunds,
    orderCount: combined.orderCount - current.orderCount,
    refundCount: combined.refundCount - current.refundCount,
    cancelledCount: combined.cancelledCount - current.cancelledCount,
  }
}

export async function fetchOrgAnalyticsForPeriod(
  orgSlug: string,
  days: number,
): Promise<AnalyticsPeriodData | { error: string }> {
  const auth = await requireOrgAnalyticsAccess(orgSlug)
  if ('error' in auth) return { error: auth.error }
  const { orgId } = auth

  const admin = createAdminClient()

  const sinceDate = new Date(Date.now() - days * 86400000).toISOString()
  const priorSinceDate = new Date(Date.now() - 2 * days * 86400000).toISOString()

  const [currentFinancial, combinedFinancial, revenueTrend, topEvents, funnel, retention, operational] =
    await Promise.all([
      getOrgFinancialSummary(admin, orgId, sinceDate),
      getOrgFinancialSummary(admin, orgId, priorSinceDate),
      getOrgRevenueTrend(admin, orgId, days),
      getOrgTopEventsByRevenue(admin, orgId, 5),
      getOrgRegistrationFunnel(admin, orgId),
      getOrgAttendeeRetention(admin, orgId),
      getOrgOperationalBreakdowns(admin, orgId),
    ])

  const priorFinancial = subtractFinancial(combinedFinancial, currentFinancial)

  const { count: activeEventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .not('status', 'in', '("Draft","Archived","Closed")')

  const { data: orgEventIds } = await admin
    .from('platform_events')
    .select('id')
    .eq('organization_id', orgId)

  let totalAttendees = 0
  if (orgEventIds && orgEventIds.length > 0) {
    const { count } = await admin
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .in('event_id', orgEventIds.map(e => e.id))
      .eq('ticket_status', 'Complete')
    totalAttendees = count ?? 0
  }

  const avgTicketPrice =
    currentFinancial.orderCount > 0 ? currentFinancial.totalIncome / currentFinancial.orderCount : 0

  return {
    financial: currentFinancial,
    priorFinancial,
    revenueTrend,
    topEvents,
    funnel,
    retention,
    operational,
    activeEventCount: activeEventCount ?? 0,
    totalAttendees,
    avgTicketPrice,
  }
}

export async function exportOrgAnalyticsExcel(
  orgSlug: string,
): Promise<{ url: string } | { error: string }> {
  const auth = await requireOrgAnalyticsAccess(orgSlug)
  if ('error' in auth) return { error: auth.error }
  const { orgId, orgName } = auth

  const admin = createAdminClient()

  const [financial, topEvents, operational] = await Promise.all([
    getOrgFinancialSummary(admin, orgId),
    getOrgTopEventsByRevenue(admin, orgId, 10),
    getOrgOperationalBreakdowns(admin, orgId),
  ])

  const buffer = await buildOrgAnalyticsWorkbook({
    orgName,
    totalRevenue: financial.totalIncome,
    totalRefunds: financial.totalRefunds,
    netRevenue: financial.netRevenue,
    activeEvents: 0, // informational placeholder; live count not needed for static export
    totalAttendees: 0,
    topEvents: topEvents.map(e => ({
      title: e.title,
      date: e.startDate,
      attendees: e.attendeeCount,
      revenue: e.netRevenue,
    })),
    applicationStats: {
      submitted:
        operational.applications.approved +
        operational.applications.declined +
        operational.applications.needsReview +
        operational.applications.completed +
        operational.applications.closed,
      approved: operational.applications.approved,
      declined: operational.applications.declined,
      approvalRate: operational.applications.approvalRate,
    },
    volunteerStats: {
      shifts: operational.volunteers.totalShifts,
      filled: operational.volunteers.confirmedSignups,
      fillRate: operational.volunteers.fillRate,
      hours: operational.volunteers.totalHoursPledged,
    },
    refundStats: {
      total: operational.refunds.totalAmount,
      rate: operational.refunds.refundRate,
      byChannel: operational.refunds.byChannel,
    },
  })

  const filePath = `org-analytics/${orgSlug}/${Date.now()}.xlsx`
  const { error: uploadError } = await admin.storage
    .from('reports')
    .upload(filePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })

  if (uploadError) return { error: 'Failed to upload report.' }

  const { data: signedData } = await admin.storage
    .from('reports')
    .createSignedUrl(filePath, 300)

  if (!signedData?.signedUrl) return { error: 'Failed to generate download link.' }

  return { url: signedData.signedUrl }
}
