-- ============================================================
-- Orders and Order Items
-- orders: one record per checkout transaction.
-- order_items: line items (ticket or merchandise) per order.
--
-- orders.id serves as the Square idempotency key.
-- payment_provider is locked at transaction time — refunds
-- always use the provider on the original order record, not
-- the EP's current setting.
--
-- DEFERRED FK RESOLUTION:
--   Adds event_attendees.order_id → orders(id)
--   (column created in migration 20260101000004; FK added here)
-- ============================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.platform_events(id),
  user_id UUID NOT NULL REFERENCES public.platform_users(id),
  payment_provider TEXT NOT NULL
    CHECK (payment_provider IN ('square', 'paypal')),  -- locked at transaction time
  payment_transaction_id TEXT,   -- set on payment completion
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'refunded', 'partial_refund', 'cancelled')),
  subtotal DECIMAL(10,2) NOT NULL,
  amount_refunded DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('ticket', 'merchandise')),
  item_id UUID NOT NULL,         -- FK to ticket_types or merchandise (enforced in app layer)
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount_refunded DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_orders_event_id ON public.orders(event_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(event_id, status);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_item ON public.order_items(item_type, item_id);

-- ── Deferred FK: event_attendees.order_id → orders(id) ───────────────────────
-- Column created in migration 20260101000004 without a FK.
-- Now that orders exists, add the constraint.

ALTER TABLE public.event_attendees
  ADD CONSTRAINT fk_event_attendees_order_id
  FOREIGN KEY (order_id) REFERENCES public.orders(id)
  ON DELETE SET NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Policies added in migration 20260101000015_rls_policies.sql.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
