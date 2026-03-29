import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaypalOrder } from '@/lib/payments/paypal'

// Called by TicketCheckoutClient before the PayPal popup opens.
// Creates a PayPal order with the correct subtotal and returns its ID.
// The client passes this ID to the PayPal JS SDK's createOrder callback.

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { eventId?: string; ticketTypeId?: string; merchandiseIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { eventId, ticketTypeId, merchandiseIds = [] } = body
  if (!eventId || !ticketTypeId) {
    return NextResponse.json({ error: 'eventId and ticketTypeId are required' }, { status: 400 })
  }

  // Fetch ticket price
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('price')
    .eq('id', ticketTypeId)
    .eq('event_id', eventId)
    .single()

  if (!ticketType) {
    return NextResponse.json({ error: 'Ticket type not found' }, { status: 404 })
  }

  // Fetch merchandise prices
  let merchandiseTotal = 0
  if (merchandiseIds.length > 0) {
    const admin = createAdminClient()
    const { data: merch } = await admin
      .from('merchandise')
      .select('price')
      .in('id', merchandiseIds)
      .eq('event_id', eventId)
    if ((merch ?? []).length !== merchandiseIds.length) {
      return NextResponse.json(
        { error: 'One or more merchandise items are no longer available.' },
        { status: 400 }
      )
    }
    merchandiseTotal = (merch ?? []).reduce(
      (sum, m) => sum + Number(m.price),
      0
    )
  }

  const subtotal = Number(ticketType.price) + merchandiseTotal
  if (subtotal <= 0) {
    return NextResponse.json({ error: 'No payment required for $0 orders' }, { status: 400 })
  }

  // Use a temporary UUID as the idempotency reference — the real orders.id is created
  // later inside purchaseTicket(). PayPal-Request-Id prevents duplicate orders on retry.
  const tempRef = `${user.id}-${eventId}-${Date.now()}`

  try {
    const paypalOrderId = await createPaypalOrder(
      Math.round(subtotal * 100),
      tempRef
    )
    return NextResponse.json({ id: paypalOrderId })
  } catch (err: unknown) {
    console.error('[paypal] create-order route error:', err)
    return NextResponse.json(
      { error: 'Failed to create PayPal order. Please try again.' },
      { status: 500 }
    )
  }
}
