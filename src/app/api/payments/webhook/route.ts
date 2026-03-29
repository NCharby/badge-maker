import { NextResponse } from 'next/server'
import { squareProvider } from '@/lib/payments/square'
import { verifyPaypalWebhook } from '@/lib/payments/paypal'
import { createAdminClient } from '@/lib/supabase/server'

// Webhooks are a reliability backstop — the primary order completion happens synchronously
// in purchaseTicket(). The webhook updates payment_transaction_id if somehow the sync call
// succeeded but the response was dropped, and handles async refund confirmations.

export async function POST(request: Request) {
  const rawBody = await request.text()
  const headers = Object.fromEntries(request.headers.entries())

  const isSquare = 'x-square-hmacsha256-signature' in headers
  const isPayPal = 'paypal-transmission-sig' in headers

  if (!isSquare && !isPayPal) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })
  }

  if (isSquare) {
    if (!squareProvider.verifyWebhook({ rawBody, headers })) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    await handleSquareEvent(rawBody)
  }

  if (isPayPal) {
    const valid = await verifyPaypalWebhook(rawBody, headers)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    await handlePaypalEvent(rawBody)
  }

  return NextResponse.json({ received: true })
}

async function handleSquareEvent(rawBody: string) {
  let event: { type?: string; data?: { object?: { payment?: { id?: string; reference_id?: string; status?: string }; refund?: { payment_id?: string; amount_money?: { amount?: number } } } } }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return
  }

  const admin = createAdminClient()

  // Square sends payment.created and payment.updated (not payment.completed)
  // Only act when payment.status === 'COMPLETED' to avoid processing pending payments
  if (event.type === 'payment.created' || event.type === 'payment.updated') {
    const payment = event.data?.object?.payment
    if (!payment?.reference_id || !payment?.id) return
    if (payment.status !== 'COMPLETED') return

    // Update payment_transaction_id if not already set (reliability backstop)
    await admin
      .from('orders')
      .update({ payment_transaction_id: payment.id })
      .eq('id', payment.reference_id)
      .is('payment_transaction_id', null)
  }

  // Square sends refund.created and refund.updated (not refund.completed)
  if (event.type === 'refund.created' || event.type === 'refund.updated') {
    const refund = event.data?.object?.refund
    if (!refund?.payment_id) return

    // Find the order by payment_transaction_id and update refund status
    const { data: order } = await admin
      .from('orders')
      .select('id, subtotal, amount_refunded')
      .eq('payment_transaction_id', refund.payment_id)
      .single()

    if (!order) return

    // Keep arithmetic in integer cents to avoid floating-point precision errors
    const refundedAmountCents = refund.amount_money?.amount ?? 0
    const currentRefundedCents = Math.round(Number(order.amount_refunded ?? 0) * 100)
    const newRefundedCents = currentRefundedCents + refundedAmountCents
    const newAmountRefunded = parseFloat((newRefundedCents / 100).toFixed(2))
    const isFullRefund = newAmountRefunded >= Number(order.subtotal)

    await admin
      .from('orders')
      .update({
        amount_refunded: newAmountRefunded,
        status: isFullRefund ? 'refunded' : 'partial_refund',
      })
      .eq('id', order.id)
  }
}

async function handlePaypalEvent(rawBody: string) {
  let event: { event_type?: string; resource?: { id?: string; custom_id?: string; amount?: { value?: string }; supplementary_data?: { related_ids?: { order_id?: string } } } }

  try {
    event = JSON.parse(rawBody)
  } catch {
    return
  }

  const admin = createAdminClient()

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const capture = event.resource
    if (!capture?.id) return

    // custom_id carries our internal order ID if set during capture
    const internalOrderId = capture.custom_id
    if (!internalOrderId) {
      console.error('[paypal webhook] PAYMENT.CAPTURE.COMPLETED: missing custom_id', { captureId: capture.id })
      return
    }

    await admin
      .from('orders')
      .update({ payment_transaction_id: capture.id })
      .eq('id', internalOrderId)
      .is('payment_transaction_id', null)
  }

  if (event.event_type === 'PAYMENT.CAPTURE.REFUNDED') {
    const refund = event.resource
    if (!refund?.id) return

    // Lookup by transaction ID (capture ID stored in payment_transaction_id)
    const captureId = refund.supplementary_data?.related_ids?.order_id ?? refund.id
    const { data: order } = await admin
      .from('orders')
      .select('id, subtotal, amount_refunded')
      .eq('payment_transaction_id', captureId)
      .single()

    if (!order) return

    // Keep arithmetic in integer cents to avoid floating-point precision errors
    const refundedAmountCents = Math.round(parseFloat(refund.amount?.value ?? '0') * 100)
    const currentRefundedCents = Math.round(Number(order.amount_refunded ?? 0) * 100)
    const newRefundedCents = currentRefundedCents + refundedAmountCents
    const newAmountRefunded = parseFloat((newRefundedCents / 100).toFixed(2))
    const isFullRefund = newAmountRefunded >= Number(order.subtotal)

    await admin
      .from('orders')
      .update({
        amount_refunded: newAmountRefunded,
        status: isFullRefund ? 'refunded' : 'partial_refund',
      })
      .eq('id', order.id)
  }
}
