'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  getPlatformFinancialSummary,
  getPlatformRevenueTrend,
  getPlatformTopOrgs,
  getPlatformTopEvents,
  getPlatformRegistrationFunnel,
  getPlatformOperationalBreakdowns,
} from '@/lib/analytics/queries'
import type { AdminAnalyticsPeriodData, FinancialSummary } from '@/lib/analytics/types'

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

export async function fetchAdminAnalyticsForPeriod(
  days: number,
): Promise<AdminAnalyticsPeriodData | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const admin = createAdminClient()

  const { data: platformUser } = await admin
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (platformUser?.role !== 'system_admin') return { error: 'Access denied.' }

  const sinceDate = new Date(Date.now() - days * 86400000).toISOString()
  const sinceDate2x = new Date(Date.now() - 2 * days * 86400000).toISOString()

  const [currentFinancial, combinedFinancial, revenueTrend, topOrgs, topEvents, funnel, operational] =
    await Promise.all([
      getPlatformFinancialSummary(admin, sinceDate),
      getPlatformFinancialSummary(admin, sinceDate2x),
      getPlatformRevenueTrend(admin, days),
      getPlatformTopOrgs(admin, 5),
      getPlatformTopEvents(admin, 5),
      getPlatformRegistrationFunnel(admin),
      getPlatformOperationalBreakdowns(admin),
    ])

  const priorFinancial = subtractFinancial(combinedFinancial, currentFinancial)

  const { count: activeEventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("Draft","Archived","Closed")')

  const { count: activeOrgCount } = await admin
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .eq('archived', false)

  const { count: totalAttendees } = await admin
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_status', 'Complete')

  return {
    financial: currentFinancial,
    priorFinancial,
    revenueTrend,
    topOrgs,
    topEvents,
    funnel,
    operational,
    activeEventCount: activeEventCount ?? 0,
    activeOrgCount: activeOrgCount ?? 0,
    totalAttendees: totalAttendees ?? 0,
  }
}
