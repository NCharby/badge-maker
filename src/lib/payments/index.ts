import { squareProvider } from './square'
import { paypalProvider } from './paypal'
import type { PaymentProvider } from './types'

export * from './types'

export function getPaymentProvider(provider: 'square' | 'paypal'): PaymentProvider {
  return provider === 'paypal' ? paypalProvider : squareProvider
}

/**
 * Look up the EP's configured payment_provider for a given event.
 * Falls back to 'square' if the EP has not configured a provider.
 */
export async function getEpPaymentProvider(
  eventId: string
): Promise<'square' | 'paypal'> {
  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = createAdminClient()

  const { data } = await admin
    .from('platform_events')
    .select('owner_id, platform_users!owner_id(payment_provider)')
    .eq('id', eventId)
    .single()

  const providerRaw = (
    data?.platform_users as { payment_provider?: string | null } | null
  )?.payment_provider

  return providerRaw === 'paypal' ? 'paypal' : 'square'
}
