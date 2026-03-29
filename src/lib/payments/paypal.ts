import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  RefundParams,
  RefundResult,
  VerifyWebhookParams,
} from './types'

const PAYPAL_BASE =
  process.env.PAYPAL_ENVIRONMENT === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`PayPal OAuth failed: ${res.status}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export const paypalProvider: PaymentProvider = {
  async createPayment({ paypalOrderId }: CreatePaymentParams): Promise<PaymentResult> {
    // At this point the user has already approved the PayPal order client-side.
    // We capture it here to move funds.
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      )
      const data = await res.json()
      if (data.status !== 'COMPLETED') {
        return { success: false, error: `PayPal capture status: ${data.status}` }
      }
      // Transaction ID is the capture ID on the first purchase unit
      const transactionId =
        data.purchase_units?.[0]?.payments?.captures?.[0]?.id as string | undefined
      return { success: true, transactionId }
    } catch (err: unknown) {
      console.error('[paypal] createPayment error:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'PayPal capture failed',
      }
    }
  },

  async refundPayment({ transactionId, amountCents }: RefundParams): Promise<RefundResult> {
    try {
      const token = await getAccessToken()
      const res = await fetch(
        `${PAYPAL_BASE}/v2/payments/captures/${transactionId}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: {
              value: (amountCents / 100).toFixed(2),
              currency_code: 'USD',
            },
          }),
          cache: 'no-store',
        }
      )
      const data = await res.json()
      if (data.status !== 'COMPLETED') {
        return { success: false, error: `PayPal refund status: ${data.status}` }
      }
      return { success: true }
    } catch (err: unknown) {
      console.error('[paypal] refundPayment error:', err)
      return {
        success: false,
        error: err instanceof Error ? err.message : 'PayPal refund failed',
      }
    }
  },

  // PayPal verification is async — use verifyPaypalWebhook() in the webhook handler
  // instead of this synchronous interface method.
  verifyWebhook(_params: VerifyWebhookParams): boolean {
    return false
  },
}

/**
 * Async PayPal webhook verification via PayPal's notification verification API.
 * Called from the webhook Route Handler (cannot use the synchronous interface method).
 */
export async function verifyPaypalWebhook(
  rawBody: string,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const token = await getAccessToken()
    const res = await fetch(
      `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: process.env.PAYPAL_WEBHOOK_ID,
          webhook_event: JSON.parse(rawBody),
        }),
        cache: 'no-store',
      }
    )
    const data = await res.json()
    return data.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal] verifyWebhook error:', err)
    return false
  }
}

/**
 * Create a PayPal order server-side and return its ID.
 * Called from /api/payments/paypal/create-order before the PayPal popup opens.
 */
export async function createPaypalOrder(
  amountCents: number,
  internalOrderId: string
): Promise<string> {
  const token = await getAccessToken()
  const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': internalOrderId, // idempotency
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: internalOrderId,
          amount: {
            currency_code: 'USD',
            value: (amountCents / 100).toFixed(2),
          },
        },
      ],
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`PayPal create order failed: ${JSON.stringify(err)}`)
  }

  const data = await res.json()
  return data.id as string
}
