import { SquareClient, SquareEnvironment } from 'square'
import crypto from 'crypto'
import type {
  PaymentProvider,
  CreatePaymentParams,
  PaymentResult,
  RefundParams,
  RefundResult,
  VerifyWebhookParams,
} from './types'

function getClient(): SquareClient {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN,
    environment:
      process.env.SQUARE_ENVIRONMENT === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  })
}

export const squareProvider: PaymentProvider = {
  async createPayment({
    orderId,
    amountCents,
    currency,
    nonce,
  }: CreatePaymentParams): Promise<PaymentResult> {
    try {
      const client = getClient()
      const response = await client.payments.create({
        sourceId: nonce!,
        idempotencyKey: orderId, // orders.id is the idempotency key per spec (CLAUDE.md §4)
        amountMoney: { amount: BigInt(amountCents), currency },
        locationId: process.env.SQUARE_LOCATION_ID!,
        referenceId: orderId,
      })
      return { success: true, transactionId: response.payment?.id }
    } catch (err: unknown) {
      console.error('[square] createPayment error:', err)
      const msg = err instanceof Error ? err.message : 'Square payment failed'
      return { success: false, error: msg }
    }
  },

  async refundPayment({
    transactionId,
    amountCents,
    orderId,
  }: RefundParams): Promise<RefundResult> {
    try {
      const client = getClient()
      await client.refunds.refundPayment({
        idempotencyKey: `refund-${orderId}`,
        paymentId: transactionId,
        amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      })
      return { success: true }
    } catch (err: unknown) {
      console.error('[square] refundPayment error:', err)
      const msg = err instanceof Error ? err.message : 'Square refund failed'
      return { success: false, error: msg }
    }
  },

  verifyWebhook({ rawBody, headers }: VerifyWebhookParams): boolean {
    const sig = headers['x-square-hmacsha256-signature'] ?? ''
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`
    const expected = crypto
      .createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY!)
      .update(webhookUrl + rawBody)
      .digest('base64')
    return sig === expected
  },
}
