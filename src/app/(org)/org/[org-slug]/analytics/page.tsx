import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgAnalyticsClient from './OrgAnalyticsClient'
import {
  getOrgFinancialSummary,
  getOrgRevenueTrend,
  getOrgTopEventsByRevenue,
  getOrgRegistrationFunnel,
  getOrgAttendeeRetention,
  getOrgOperationalBreakdowns,
} from '@/lib/analytics/queries'

export default async function OrgAnalyticsPage({
  params,
}: {
  params: Promise<{ 'org-slug': string }>
}) {
  const { 'org-slug': orgSlug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: org } = await admin
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/dashboard')

  const { data: callerProfile } = await supabase
    .from('platform_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSa = callerProfile?.role === 'system_admin'

  if (!isSa) {
    const { data: membership } = await admin
      .from('organization_members')
      .select('access_level')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (
      !membership ||
      (membership.access_level !== 'organization_lead' &&
        membership.access_level !== 'event_promoter')
    ) {
      redirect(`/org/${orgSlug}/dashboard`)
    }
  }

  const sinceDate30d = new Date(Date.now() - 30 * 86400000).toISOString()
  const sinceDate60d = new Date(Date.now() - 60 * 86400000).toISOString()

  const [financial, combined60d, trend30d, topEvents, funnel, retention, operational] = await Promise.all([
    getOrgFinancialSummary(admin, org.id, sinceDate30d),
    getOrgFinancialSummary(admin, org.id, sinceDate60d),
    getOrgRevenueTrend(admin, org.id, 30),
    getOrgTopEventsByRevenue(admin, org.id, 5),
    getOrgRegistrationFunnel(admin, org.id),
    getOrgAttendeeRetention(admin, org.id),
    getOrgOperationalBreakdowns(admin, org.id),
  ])

  const priorFinancial = {
    totalIncome: combined60d.totalIncome - financial.totalIncome,
    totalRefunds: combined60d.totalRefunds - financial.totalRefunds,
    totalCancellations: combined60d.totalCancellations - financial.totalCancellations,
    netRevenue: combined60d.netRevenue - financial.netRevenue,
    orderCount: combined60d.orderCount - financial.orderCount,
    refundCount: combined60d.refundCount - financial.refundCount,
    cancelledCount: combined60d.cancelledCount - financial.cancelledCount,
  }

  const { count: activeEventCount } = await admin
    .from('platform_events')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .not('status', 'in', '("Draft","Archived","Closed")')

  const { data: orgEventIds } = await admin
    .from('platform_events')
    .select('id')
    .eq('organization_id', org.id)

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
    financial.orderCount > 0 ? financial.totalIncome / financial.orderCount : 0

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <h1
        style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--sd-text)',
          marginBottom: '4px',
        }}
      >
        Organization Analytics
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--sd-muted)', marginBottom: '24px' }}>
        {org.name}
      </p>

      <OrgAnalyticsClient
        orgSlug={orgSlug}
        financial={financial}
        priorFinancial={priorFinancial}
        revenueTrend={trend30d}
        topEvents={topEvents}
        funnel={funnel}
        retention={retention}
        operational={operational}
        activeEventCount={activeEventCount ?? 0}
        totalAttendees={totalAttendees}
        avgTicketPrice={avgTicketPrice}
      />
    </div>
  )
}
