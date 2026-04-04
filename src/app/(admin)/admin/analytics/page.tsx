import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AdminAnalyticsClient from './AdminAnalyticsClient'
import {
  getPlatformFinancialSummary,
  getPlatformRevenueTrend,
  getPlatformTopOrgs,
  getPlatformTopEvents,
  getPlatformRegistrationFunnel,
  getPlatformOperationalBreakdowns,
} from '@/lib/analytics/queries'

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const days = 30
  const sinceDate30d = new Date(Date.now() - days * 86400000).toISOString()
  const sinceDate60d = new Date(Date.now() - 2 * days * 86400000).toISOString()

  const [financial, financialCombined, trend30d, topOrgs, topEvents, funnel, operational] = await Promise.all([
    getPlatformFinancialSummary(admin, sinceDate30d),
    getPlatformFinancialSummary(admin, sinceDate60d),
    getPlatformRevenueTrend(admin, 30),
    getPlatformTopOrgs(admin, 5),
    getPlatformTopEvents(admin, 5),
    getPlatformRegistrationFunnel(admin),
    getPlatformOperationalBreakdowns(admin),
  ])

  const priorFinancial = {
    totalIncome: financialCombined.totalIncome - financial.totalIncome,
    totalRefunds: financialCombined.totalRefunds - financial.totalRefunds,
    totalCancellations: financialCombined.totalCancellations - financial.totalCancellations,
    netRevenue:
      (financialCombined.totalIncome - financial.totalIncome) -
      (financialCombined.totalRefunds - financial.totalRefunds),
    orderCount: financialCombined.orderCount - financial.orderCount,
    refundCount: financialCombined.refundCount - financial.refundCount,
    cancelledCount: financialCombined.cancelledCount - financial.cancelledCount,
  }

  const { count: activeEventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '("Draft","Archived","Closed")')

  const { count: orgCount } = await admin
    .from('organizations')
    .select('*', { count: 'exact', head: true })
    .eq('archived', false)

  const { count: totalAttendees } = await admin
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('ticket_status', 'Complete')

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Link
        href="/admin/dashboard"
        style={{
          fontSize: '13px',
          color: 'var(--sd-purple)',
          textDecoration: 'none',
          display: 'block',
          marginBottom: '1.5rem',
        }}
      >
        &larr; Dashboard
      </Link>

      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--sd-text)',
          marginBottom: '4px',
        }}
      >
        Platform Analytics
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        All organizations and events
      </p>

      <AdminAnalyticsClient
        financial={financial}
        priorFinancial={priorFinancial}
        revenueTrend={trend30d}
        topOrgs={topOrgs}
        topEvents={topEvents}
        funnel={funnel}
        operational={operational}
        activeEventCount={activeEventCount ?? 0}
        activeOrgCount={orgCount ?? 0}
        totalAttendees={totalAttendees ?? 0}
      />
    </div>
  )
}
