-- Add processed_refund_ids to orders table
-- Used by the webhook handler to deduplicate Square refund events.
-- Square delivers webhooks at-least-once; without this guard, duplicate
-- refund.created / refund.updated deliveries would double-count amount_refunded.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS processed_refund_ids TEXT[] DEFAULT '{}';
